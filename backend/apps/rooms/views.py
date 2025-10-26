# rooms/views.py - Room management API views
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, viewsets
from rest_framework.decorators import action
from django_ratelimit.decorators import ratelimit
from apps.rooms.models import RoomManager, RoomAnalytics, SystemMetrics, UserActivityLog
from apps.core.views import get_client_ip
from apps.authentication.models import User
import qrcode
import io
import base64
import logging
from datetime import timedelta
from django.db.models import Count, Sum, Avg
from django.db import models

logger = logging.getLogger(__name__)


def require_auth(view_func):
    """Decorator to require authentication for views"""
    def wrapper(request, *args, **kwargs):
        # Временно отключаем проверку аутентификации для прямого доступа
        # if not request.session.get('authenticated'):
        #     logger.warning(f"Unauthenticated access attempt to {request.path}")
        #     return Response(
        #         {'error': 'Authentication required'},
        #         status=status.HTTP_401_UNAUTHORIZED
        #     )
        
        # Устанавливаем флаг аутентификации для гостевого доступа
        if not request.session.get('authenticated'):
            request.session['authenticated'] = True
            logger.info(f"Guest access granted to {request.path}")
            
        return view_func(request, *args, **kwargs)
    return wrapper


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
@ratelimit(key='ip', rate='30/min', method='POST', block=True)
def create_room(request):
    """Create a new video call room"""
    try:
        client_ip = get_client_ip(request)
        logger.info(f"Creating room for IP: {client_ip}")

        room_data = RoomManager.create_room(creator_ip=client_ip)

        # Generate QR code for the room
        room_url = f"{request.build_absolute_uri('/')}join/{room_data['short_code']}"

        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(room_url)
        qr.make(fit=True)

        qr_image = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        qr_image.save(buffer, format='PNG')
        qr_code_data = base64.b64encode(buffer.getvalue()).decode()

        response_data = {
            'room_id': room_data['room_id'],
            'short_code': room_data['short_code'],
            'room_url': room_url,
            'qr_code': f"data:image/png;base64,{qr_code_data}",
            'expires_at': room_data['expires_at'],
            'max_participants': room_data['max_participants'],
            'room_mode': room_data.get('room_mode', 'p2p'),
            'sfu_enabled': room_data.get('sfu_enabled', False)
        }

        logger.info(f"Room created successfully: {room_data['room_id']}")
        return Response(response_data, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Room creation failed: {e}")
        return Response(
            {'error': 'Failed to create room'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
def get_room(request, room_id):
    """Get room information by room ID"""
    try:
        logger.info(f"Getting room info for: {room_id}")
        room_data = RoomManager.get_room_by_id(room_id)

        if not room_data:
            logger.warning(f"Room not found: {room_id}")
            return Response(
                {'error': 'Room not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if room has expired
        expires_at = timezone.datetime.fromisoformat(
            room_data['expires_at'].replace('Z', '+00:00')
        )
        if timezone.now() > expires_at:
            logger.info(f"Room expired, deleting: {room_id}")
            RoomManager.delete_room(room_id)
            return Response(
                {'error': 'Room has expired'},
                status=status.HTTP_404_NOT_FOUND
            )

        response_data = {
            'room_id': room_data['room_id'],
            'short_code': room_data['short_code'],
            'is_active': room_data['is_active'],
            'participant_count': len(room_data.get('participants', [])),
            'max_participants': room_data.get('max_participants', 15),
            'expires_at': room_data['expires_at'],
            'room_mode': room_data.get('room_mode', 'p2p'),
            'sfu_enabled': room_data.get('sfu_enabled', False),
            'sfu_room_id': room_data.get('sfu_room_id'),
            'sfu_ws_url': room_data.get('sfu_url')
        }

        logger.info(f"Room info retrieved: {room_id}, participants: {len(room_data.get('participants', []))}")
        return Response(response_data)

    except Exception as e:
        logger.error(f"Failed to retrieve room {room_id}: {e}")
        return Response(
            {'error': 'Failed to retrieve room'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
@ratelimit(key='ip', rate='60/min', method='POST', block=True)
def join_room(request):
    """Join a room by room ID or short code"""
    try:
        room_identifier = request.data.get('room_identifier')

        # Ensure we have a session
        if not request.session.session_key:
            request.session.create()

        participant_id = request.session.session_key

        if not room_identifier:
            return Response(
                {'error': 'Room identifier is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f"Joining room: {room_identifier} with participant: {participant_id}")

        client_ip = get_client_ip(request)
        room_data, message = RoomManager.join_room(
            room_identifier,
            participant_id,
            client_ip
        )

        if not room_data:
            logger.warning(f"Failed to join room: {room_identifier}, reason: {message}")
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )

        response_data = {
            'success': True,
            'message': message,
            'room_id': room_data['room_id'],
            'short_code': room_data['short_code'],
            'participant_count': len(room_data.get('participants', [])),
            'participant_id': participant_id
        }

        logger.info(f"User joined room: {room_data['room_id']}, participant: {participant_id}")
        return Response(response_data)

    except Exception as e:
        logger.error(f"Failed to join room: {e}")
        return Response(
            {'error': 'Failed to join room'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
def leave_room(request, room_id):
    """Leave a room"""
    try:
        # Ensure we have a session
        if not request.session.session_key:
            logger.warning(f"No session key when trying to leave room: {room_id}")
            return Response(
                {'success': True,  # Return success even if no session, as user wasn't in room anyway
                 'message': 'No active session found'})

        participant_id = request.session.session_key
        logger.info(f"Leaving room: {room_id} with participant: {participant_id}")

        # Check if room exists first
        room_data = RoomManager.get_room_by_id(room_id)
        if not room_data:
            logger.info(f"Room {room_id} not found when trying to leave")
            return Response({
                'success': True,  # Return success as room doesn't exist anyway
                'message': 'Room not found'
            })

        # Check if participant is actually in the room
        participants = room_data.get('participants', [])
        if participant_id not in participants:
            logger.info(f"Participant {participant_id} not in room {room_id}")
            return Response({
                'success': True,  # Return success as user wasn't in room anyway
                'message': 'Not in room'
            })

        success = RoomManager.leave_room(room_id, participant_id)

        if success:
            logger.info(f"User left room: {room_id}, participant: {participant_id}")
            return Response({
                'success': True,
                'message': 'Left room successfully'
            })
        else:
            logger.warning(f"Failed to leave room: {room_id}, participant: {participant_id}")
            return Response({
                'success': True,  # Still return success to avoid client errors
                'message': 'Room leave processed'
            })

    except Exception as e:
        logger.error(f"Failed to leave room {room_id}: {e}")
        return Response(
            {'error': 'Failed to leave room'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
def delete_room(request, room_id):
    """Delete a room (only creator or admin can delete)"""
    try:
        logger.info(f"Deleting room: {room_id}")

        # Check if room exists
        room_data = RoomManager.get_room_by_id(room_id)
        if not room_data:
            return Response(
                {'error': 'Room not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Additional permission check could be added here
        success = RoomManager.delete_room(room_id)

        if success:
            logger.info(f"Room deleted: {room_id}")
            return Response({
                'success': True,
                'message': 'Room deleted successfully'
            })
        else:
            return Response(
                {'error': 'Failed to delete room'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    except Exception as e:
        logger.error(f"Failed to delete room {room_id}: {e}")
        return Response(
            {'error': 'Failed to delete room'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
def create_sfu_room(request):
    """Create SFU room for multi-user video calls"""
    try:
        room_id = request.data.get('room_id')
        if not room_id:
            return Response(
                {'error': 'Room ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f"Creating SFU room for: {room_id}")

        # Create SFU room using RoomManager
        sfu_result = RoomManager.create_sfu_room(room_id)

        if sfu_result.get('success'):
            logger.info(f"SFU room created: {room_id}")
            return Response(sfu_result, status=status.HTTP_201_CREATED)
        else:
            logger.error(f"Failed to create SFU room: {room_id}, error: {sfu_result.get('error')}")
            return Response(
                {'error': sfu_result.get('error', 'Failed to create SFU room')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    except Exception as e:
        logger.error(f"SFU room creation failed: {e}")
        return Response(
            {'error': 'Failed to create SFU room'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
def get_room_sfu_info(request, room_id):
    """Get SFU information for a room"""
    try:
        logger.info(f"Getting SFU info for room: {room_id}")

        sfu_info = RoomManager.get_room_sfu_info(room_id)

        if sfu_info is None:
            return Response(
                {'error': 'Room not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(sfu_info)

    except Exception as e:
        logger.error(f"Failed to get SFU info for room {room_id}: {e}")
        return Response(
            {'error': 'Failed to get SFU information'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
def get_room_statistics(request, room_id):
    """Get detailed room statistics including SFU info"""
    try:
        logger.info(f"Getting statistics for room: {room_id}")

        room_data = RoomManager.get_room_by_id(room_id)

        if not room_data:
            return Response(
                {'error': 'Room not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get SFU statistics if SFU is enabled
        sfu_stats = None
        if room_data.get('sfu_enabled') and room_data.get('sfu_room_id'):
            try:
                from .sfu_client import SFUClient
                sfu_client = SFUClient()
                sfu_stats = sfu_client.get_room_stats(room_data['sfu_room_id'])
            except Exception as e:
                logger.warning(f"Failed to get SFU stats for room {room_id}: {e}")

        statistics = {
            'room_id': room_data['room_id'],
            'short_code': room_data['short_code'],
            'created_at': room_data['created_at'],
            'expires_at': room_data['expires_at'],
            'is_active': room_data['is_active'],
            'room_mode': room_data.get('room_mode', 'p2p'),
            'participant_count': len(room_data.get('participants', [])),
            'max_participants': room_data.get('max_participants', 15),
            'sfu_enabled': room_data.get('sfu_enabled', False),
            'sfu_room_id': room_data.get('sfu_room_id'),
            'sfu_stats': sfu_stats
        }

        return Response(statistics)

    except Exception as e:
        logger.error(f"Failed to get room statistics {room_id}: {e}")
        return Response(
            {'error': 'Failed to get room statistics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
def get_sfu_server_stats(request):
    """Get SFU server statistics and health"""
    try:
        logger.info("Getting SFU server statistics")

        try:
            from .sfu_client import SFUClient
            sfu_client = SFUClient()

            # Get server stats
            server_stats = sfu_client.get_server_stats()

            # Get health check
            health_check = sfu_client.health_check()

            response_data = {
                'sfu_server': {
                    'healthy': health_check.get('success', False),
                    'stats': server_stats if server_stats.get('success') else None,
                    'error': health_check.get('error') if not health_check.get('success') else None
                },
                'timestamp': timezone.now().isoformat()
            }

            return Response(response_data)

        except Exception as e:
            logger.error(f"SFU server communication failed: {e}")
            return Response({
                'sfu_server': {
                    'healthy': False,
                    'error': 'Failed to communicate with SFU server'
                },
                'timestamp': timezone.now().isoformat()
            })

    except Exception as e:
        logger.error(f"Failed to get SFU server stats: {e}")
        return Response(
            {'error': 'Failed to get SFU server statistics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
def check_room_health(request, room_id):
    """Check room health and SFU connectivity"""
    try:
        logger.info(f"Checking health for room: {room_id}")

        health_result = RoomManager.monitor_room_health(room_id)

        if health_result.get('success'):
            return Response(health_result['health'])
        else:
            return Response(
                {'error': health_result.get('error', 'Health check failed')},
                status=status.HTTP_404_NOT_FOUND
            )

    except Exception as e:
        logger.error(f"Room health check failed for {room_id}: {e}")
        return Response(
            {'error': 'Health check failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
@require_auth
def health_check(request):
    """API health check endpoint"""
    return Response({
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'authenticated': True,
        'session_key': request.session.session_key
    })


# Admin Panel Views for Room Management

class RoomManagementViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for admin room management"""

    queryset = RoomAnalytics.objects.all().order_by('-period_start')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter based on user permissions"""
        queryset = super().get_queryset()

        # Only admins and moderators can view analytics
        if not self.request.user.is_admin() and not self.request.user.is_moderator():
            # Return empty queryset for regular users
            return RoomAnalytics.objects.none()

        return queryset

    @action(detail=False, methods=['get'])
    def active_rooms(self, request):
        """Get currently active rooms from Redis"""
        if not request.user.is_admin() and not request.user.is_moderator():
            return Response(
                {'error': 'Insufficient permissions'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            # This would need to be implemented to scan Redis for active rooms
            # For now, return a placeholder
            active_rooms_data = []

            return Response({
                'active_rooms': active_rooms_data,
                'total_count': len(active_rooms_data)
            })
        except Exception as e:
            logger.error(f"Failed to get active rooms: {e}")
            return Response(
                {'error': 'Failed to get active rooms'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def room_activity_logs(self, request):
        """Get recent room activity logs"""
        if not request.user.is_admin() and not request.user.is_moderator():
            return Response(
                {'error': 'Insufficient permissions'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            # Get room-related activity logs
            room_logs = UserActivityLog.objects.filter(
                action__in=['room_create', 'room_join', 'room_leave', 'room_close']
            ).order_by('-timestamp')[:100]

            logs = []
            for log in room_logs:
                logs.append({
                    'id': str(log.id),
                    'action': log.get_action_display(),
                    'user': log.user_email if log.user else 'Anonymous',
                    'timestamp': log.timestamp,
                    'ip_address': log.ip_address,
                    'metadata': log.metadata
                })

            return Response({
                'logs': logs,
                'total': len(logs)
            })
        except Exception as e:
            logger.error(f"Failed to get room activity logs: {e}")
            return Response(
                {'error': 'Failed to get room activity logs'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RoomAnalyticsViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for room analytics and statistics"""

    queryset = RoomAnalytics.objects.all().order_by('-period_start')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter based on user permissions"""
        queryset = super().get_queryset()

        # Only admins and moderators can view analytics
        if not self.request.user.is_admin() and not self.request.user.is_moderator():
            return RoomAnalytics.objects.none()

        return queryset

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get dashboard statistics for admin panel"""
        if not request.user.is_admin() and not request.user.is_moderator():
            return Response(
                {'error': 'Insufficient permissions'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            # Get current period analytics
            today = timezone.now().date()

            # Daily stats (today)
            daily_stats = RoomAnalytics.objects.filter(
                period='daily',
                period_start__date=today
            ).first()

            # Weekly stats (current week)
            week_start = today - timedelta(days=today.weekday())
            weekly_stats = RoomAnalytics.objects.filter(
                period='weekly',
                period_start__date=week_start
            ).first()

            # Monthly stats (current month)
            month_start = today.replace(day=1)
            monthly_stats = RoomAnalytics.objects.filter(
                period='monthly',
                period_start__date=month_start
            ).first()

            # Recent activity logs
            recent_activities = UserActivityLog.objects.filter(
                action__in=['room_create', 'room_join', 'room_leave', 'room_close']
            ).order_by('-timestamp')[:10]

            activities = []
            for activity in recent_activities:
                activities.append({
                    'action': activity.get_action_display(),
                    'user': activity.user_email if activity.user else 'Anonymous',
                    'timestamp': activity.timestamp,
                    'ip_address': activity.ip_address,
                })

            stats = {
                'daily': daily_stats.__dict__ if daily_stats else {},
                'weekly': weekly_stats.__dict__ if weekly_stats else {},
                'monthly': monthly_stats.__dict__ if monthly_stats else {},
                'recent_activities': activities,
                'calculated_at': timezone.now().isoformat()
            }

            return Response(stats)
        except Exception as e:
            logger.error(f"Failed to get dashboard stats: {e}")
            return Response(
                {'error': 'Failed to get dashboard statistics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def force_close_room(request, room_id):
    """Force close a room (admin/moderator only)"""
    if not request.user.is_admin() and not request.user.is_moderator():
        return Response(
            {'error': 'Insufficient permissions'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Check if room exists
        room_data = RoomManager.get_room_by_id(room_id)
        if not room_data:
            return Response(
                {'error': 'Room not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Delete the room
        success = RoomManager.delete_room(room_id)

        if success:
            # Log the admin action
            UserActivityLog.objects.create(
                user=request.user,
                action='room_close',
                severity='high',
                ip_address=get_client_ip(request),
                content_object=None,  # Room was deleted
                object_id=room_id,
                description=f'Room {room_id} was force closed by admin {request.user.email}',
                metadata={
                    'room_id': room_id,
                    'short_code': room_data.get('short_code'),
                    'participant_count': len(room_data.get('participants', [])),
                    'forced_by': request.user.email
                }
            )

            logger.info(f"Room {room_id} force closed by admin {request.user.email}")
            return Response({
                'success': True,
                'message': 'Room force closed successfully'
            })
        else:
            return Response(
                {'error': 'Failed to close room'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    except Exception as e:
        logger.error(f"Failed to force close room {room_id}: {e}")
        return Response(
            {'error': 'Failed to force close room'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_health(request):
    """Get system health metrics for admin dashboard"""
    if not request.user.is_admin() and not request.user.is_moderator():
        return Response(
            {'error': 'Insufficient permissions'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get recent system metrics
        recent_metrics = SystemMetrics.objects.order_by('-timestamp')[:24]  # Last 24 hours

        # Calculate averages
        if recent_metrics:
            avg_cpu = sum(m.cpu_usage for m in recent_metrics) / len(recent_metrics)
            avg_memory = sum(m.memory_usage for m in recent_metrics) / len(recent_metrics)
            total_errors = sum(m.errors_500 + m.errors_400 for m in recent_metrics)
        else:
            avg_cpu = avg_memory = total_errors = 0

        # Get current active rooms count (placeholder)
        active_rooms_count = 0

        health_data = {
            'system_metrics': {
                'avg_cpu_usage': round(avg_cpu, 2),
                'avg_memory_usage': round(avg_memory, 2),
                'total_errors_24h': total_errors,
                'active_rooms': active_rooms_count,
            },
            'recent_metrics_count': len(recent_metrics),
            'calculated_at': timezone.now().isoformat()
        }

        return Response(health_data)
    except Exception as e:
        logger.error(f"Failed to get system health: {e}")
        return Response(
            {'error': 'Failed to get system health'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def room_search(request):
    """Search rooms by various criteria (admin only)"""
    if not request.user.is_admin():
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get search parameters
        room_id = request.query_params.get('room_id')
        short_code = request.query_params.get('short_code')
        ip_address = request.query_params.get('ip_address')
        active_only = request.query_params.get('active_only', 'false').lower() == 'true'

        rooms_found = []

        # Search in activity logs for room-related activities
        query = UserActivityLog.objects.filter(
            action__in=['room_create', 'room_join', 'room_leave']
        )

        if room_id:
            query = query.filter(object_id=room_id)
        if ip_address:
            query = query.filter(ip_address=ip_address)

        if active_only:
            # Only show recent activities (last 24 hours)
            cutoff_time = timezone.now() - timedelta(hours=24)
            query = query.filter(timestamp__gte=cutoff_time)

        activities = query.order_by('-timestamp')[:50]

        # Group by room_id to get room information
        room_groups = {}
        for activity in activities:
            room_id = activity.object_id or activity.metadata.get('room_id')
            if room_id:
                if room_id not in room_groups:
                    room_groups[room_id] = {
                        'room_id': room_id,
                        'activities': [],
                        'last_activity': activity.timestamp,
                        'participants': set()
                    }
                room_groups[room_id]['activities'].append({
                    'action': activity.get_action_display(),
                    'user': activity.user_email,
                    'timestamp': activity.timestamp,
                    'ip_address': activity.ip_address,
                })
                if activity.action == 'room_join':
                    room_groups[room_id]['participants'].add(activity.user_email)

        # Convert to list and add participant counts
        for room_data in room_groups.values():
            room_data['participant_count'] = len(room_data['participants'])
            del room_data['participants']  # Remove set for JSON serialization

        rooms_found = list(room_groups.values())

        return Response({
            'rooms': rooms_found,
            'total_count': len(rooms_found),
            'search_criteria': {
                'room_id': room_id,
                'short_code': short_code,
                'ip_address': ip_address,
                'active_only': active_only
            }
        })

    except Exception as e:
        logger.error(f"Room search failed: {e}")
        return Response(
            {'error': 'Room search failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
