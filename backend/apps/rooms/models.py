# rooms/models.py - Room management models
import uuid
import string
import secrets
import logging
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.db import models

logger = logging.getLogger(__name__)


class RoomManager:
    """
    Manager class for room operations using Redis for temporary storage.
    Implements all CRUD operations for video call rooms.
    """

    @staticmethod
    def _get_redis_client():
        """Get Redis client instance"""
        from django.core.cache import cache
        return cache

    @classmethod
    def generate_short_code(cls, length=None):
        """Generate a unique short code for room access"""
        length = length or getattr(settings, 'SHORT_CODE_LENGTH', 6)
        characters = string.ascii_uppercase + string.digits

        # Ensure uniqueness by checking existing codes
        cache = cls._get_redis_client()
        max_attempts = 100

        for _ in range(max_attempts):
            code = ''.join(secrets.choice(characters) for _ in range(length))
            if not cache.get(f'room_code_{code}'):
                return code

        raise ValueError("Unable to generate unique short code")

    @classmethod
    def create_room(cls, creator_ip=None):
        """Create a new video call room"""
        cache = cls._get_redis_client()

        room_data = {
            'room_id': str(uuid.uuid4()),
            'short_code': cls.generate_short_code(),
            'created_at': timezone.now().isoformat(),
            'participants': [],
            'is_active': True,
            'expires_at': (
                timezone.now() +
                timedelta(hours=getattr(settings, 'ROOM_EXPIRY_HOURS', 24))
            ).isoformat(),
            'creator_ip': creator_ip,
            'max_participants': getattr(settings, 'MAX_PARTICIPANTS_PER_ROOM', 15),
            # SFU integration fields
            'sfu_room_id': None,  # Will be set when SFU room is created
            'sfu_enabled': False,
            'sfu_url': None,
            'room_mode': 'p2p',  # 'p2p' or 'sfu'
            'participant_threshold_reached': False
        }

        # Store room data with expiration
        cache.set(
            f'room_{room_data["room_id"]}',
            room_data,
            timeout=getattr(settings, 'ROOM_EXPIRY_HOURS', 24) * 3600
        )

        # Create code mapping for easy lookup
        cache.set(
            f'room_code_{room_data["short_code"]}',
            room_data["room_id"],
            timeout=getattr(settings, 'ROOM_EXPIRY_HOURS', 24) * 3600
        )

        # Log room creation
        from apps.core.models import RoomActivityLog
        RoomActivityLog.objects.create(
            room_id=room_data["room_id"],
            action='created',
            ip_address=creator_ip
        )

        return room_data

    @classmethod
    def get_room_by_id(cls, room_id):
        """Retrieve room data by room ID"""
        cache = cls._get_redis_client()
        return cache.get(f'room_{room_id}')

    @classmethod
    def get_room_by_code(cls, short_code):
        """Retrieve room data by short code"""
        cache = cls._get_redis_client()
        room_id = cache.get(f'room_code_{short_code}')

        if room_id:
            return cls.get_room_by_id(room_id)
        return None

    @classmethod
    def join_room(cls, room_identifier, participant_id, participant_ip=None):
        """
        Add participant to room.
        room_identifier can be either room_id or short_code
        """
        cache = cls._get_redis_client()

        # Try to get room by ID first, then by code
        room_data = cls.get_room_by_id(room_identifier)
        if not room_data:
            room_data = cls.get_room_by_code(room_identifier)

        if not room_data:
            return None, "Room not found"

        # Check if room is active and not expired
        if not room_data.get('is_active', False):
            return None, "Room is not active"

        expires_at = timezone.datetime.fromisoformat(
            room_data['expires_at'].replace('Z', '+00:00')
        )
        if timezone.now() > expires_at:
            cls.delete_room(room_data['room_id'])
            return None, "Room has expired"

        # Check participant limit
        current_participants = room_data.get('participants', [])
        max_participants = room_data.get('max_participants', 15)

        if len(current_participants) >= max_participants:
            return None, "Room is full"

        # Add participant if not already in room
        if participant_id not in current_participants:
            current_participants.append(participant_id)
            room_data['participants'] = current_participants

            # Check if we should switch to SFU mode
            should_create_sfu = False
            if len(current_participants) >= getattr(settings, 'SFU_THRESHOLD', 8):
                should_create_sfu = True

            # Create SFU room if threshold reached
            if should_create_sfu:
                try:
                    sfu_result = cls.create_sfu_room(room_data['room_id'])
                    if sfu_result and sfu_result.get('success'):
                        # Log SFU room creation
                        from apps.core.models import RoomActivityLog
                        RoomActivityLog.objects.create(
                            room_id=room_data["room_id"],
                            action='sfu_enabled',
                            participant_count=len(current_participants),
                            metadata={'sfu_room_id': sfu_result.get('sfu_room_id')}
                        )
                except Exception as e:
                    logger.error(f"Error creating SFU room: {e}")
                    # Ensure fallback to P2P mode
                    cls._fallback_to_p2p_mode(room_data['room_id'], f"SFU creation error: {str(e)}")

            # Update room data
            cache.set(
                f'room_{room_data["room_id"]}',
                room_data,
                timeout=getattr(settings, 'ROOM_EXPIRY_HOURS', 24) * 3600
            )

            # Log participant join
            from apps.core.models import RoomActivityLog
            RoomActivityLog.objects.create(
                room_id=room_data["room_id"],
                action='joined',
                participant_count=len(current_participants),
                ip_address=participant_ip
            )

        return room_data, "Successfully joined room"

    @classmethod
    def leave_room(cls, room_id, participant_id):
        """Remove participant from room"""
        cache = cls._get_redis_client()
        room_data = cls.get_room_by_id(room_id)

        if not room_data:
            return False

        participants = room_data.get('participants', [])
        if participant_id in participants:
            participants.remove(participant_id)
            room_data['participants'] = participants

            # Update room data
            cache.set(
                f'room_{room_id}',
                room_data,
                timeout=getattr(settings, 'ROOM_EXPIRY_HOURS', 24) * 3600
            )

            # Log participant leave
            from apps.core.models import RoomActivityLog
            RoomActivityLog.objects.create(
                room_id=room_id,
                action='left',
                participant_count=len(participants)
            )

            # Delete room if no participants left
            if not participants:
                cls.delete_room(room_id)

            return True

        return False

    @classmethod
    def delete_room(cls, room_id):
        """Delete room and clean up all associated data"""
        cache = cls._get_redis_client()
        room_data = cls.get_room_by_id(room_id)

        if room_data:
            # Clean up SFU room first
            sfu_cleanup_result = cls.cleanup_sfu_room(room_id)
            if not sfu_cleanup_result.get('success') and sfu_cleanup_result.get('error') != 'No SFU room to cleanup':
                logger.warning(f"SFU cleanup warning for room {room_id}: {sfu_cleanup_result.get('error')}")

            # Remove code mapping
            short_code = room_data.get('short_code')
            if short_code:
                cache.delete(f'room_code_{short_code}')

            # Remove room data
            cache.delete(f'room_{room_id}')

            # Log room deletion
            from apps.core.models import RoomActivityLog
            RoomActivityLog.objects.create(
                room_id=room_id,
                action='deleted'
            )

            logger.info(f"Room deleted successfully: {room_id}")
            return True

        return False

    @classmethod
    def create_sfu_room(cls, room_id):
        """Create SFU room for multi-user video calls with fallback to P2P.

        In development environments the SFU health check can be flaky (DNS/ports),
        but the SFU itself may still be reachable. To avoid premature fallback,
        we log health issues but still attempt room creation.
        """
        try:
            from .sfu_client import SFUClient
            sfu_client = SFUClient()

            # Check SFU server health first, but do not fail hard on errors
            health_check = sfu_client.health_check()
            if not health_check.get('success'):
                logger.warning(
                    "SFU health check failed for room %s: %s",
                    room_id,
                    health_check.get('error', 'unknown error'),
                )
                # Do NOT return fallback here – try to create a room anyway.

            # Create SFU room
            sfu_room_response = sfu_client.create_room(room_id)

            if sfu_room_response.get('success'):
                sfu_room_id = sfu_room_response.get('room_id')
                sfu_ws_url = sfu_room_response.get('ws_url')

                # Update room data with SFU information
                cache = cls._get_redis_client()
                room_data = cls.get_room_by_id(room_id)

                if room_data:
                    room_data['sfu_room_id'] = sfu_room_id
                    room_data['sfu_enabled'] = True
                    room_data['sfu_url'] = sfu_ws_url
                    room_data['room_mode'] = 'sfu'

                    # Update room data in cache
                    cache.set(
                        f'room_{room_id}',
                        room_data,
                        timeout=getattr(settings, 'ROOM_EXPIRY_HOURS', 24) * 3600
                    )

                    logger.info(f"SFU room created successfully: {room_id}")
                    return {
                        'success': True,
                        'sfu_room_id': sfu_room_id,
                        'sfu_ws_url': sfu_ws_url,
                        'mode': 'sfu'
                    }
            else:
                logger.warning(f"SFU room creation failed, falling back to P2P: {sfu_room_response.get('error')}")
                return cls._fallback_to_p2p_mode(room_id, sfu_room_response.get('error'))

        except Exception as e:
            logger.error(f"SFU room creation error, falling back to P2P: {e}")
            return cls._fallback_to_p2p_mode(room_id, str(e))

    @classmethod
    def _fallback_to_p2p_mode(cls, room_id, reason):
        """Fallback to P2P mode when SFU is not available"""
        cache = cls._get_redis_client()
        room_data = cls.get_room_by_id(room_id)

        if room_data:
            # Update room to stay in P2P mode but allow more participants
            room_data['room_mode'] = 'p2p_fallback'
            room_data['sfu_enabled'] = False
            room_data['fallback_reason'] = reason

            # Update room data in cache
            cache.set(
                f'room_{room_id}',
                room_data,
                timeout=getattr(settings, 'ROOM_EXPIRY_HOURS', 24) * 3600
            )

            logger.info(f"Room {room_id} set to P2P fallback mode: {reason}")
            return {
                'success': True,
                'mode': 'p2p_fallback',
                'reason': reason,
                'message': 'Operating in P2P mode due to SFU unavailability'
            }

        return {'success': False, 'error': 'Room not found for fallback'}

    @classmethod
    def cleanup_sfu_room(cls, room_id):
        """Clean up SFU room when Django room is being deleted"""
        try:
            room_data = cls.get_room_by_id(room_id)
            if not room_data:
                return {'success': False, 'error': 'Room not found'}

            sfu_room_id = room_data.get('sfu_room_id')
            if sfu_room_id:
                from .sfu_client import SFUClient
                sfu_client = SFUClient()

                # Delete SFU room
                result = sfu_client.delete_room(sfu_room_id)

                if result.get('success'):
                    logger.info(f"SFU room cleaned up: {sfu_room_id}")
                    return {'success': True, 'message': 'SFU room deleted'}
                else:
                    logger.error(f"Failed to cleanup SFU room {sfu_room_id}: {result.get('error')}")
                    return {'success': False, 'error': result.get('error')}

            return {'success': True, 'message': 'No SFU room to cleanup'}

        except Exception as e:
            logger.error(f"SFU room cleanup error for {room_id}: {e}")
            return {'success': False, 'error': str(e)}

    @classmethod
    def monitor_room_health(cls, room_id):
        """Monitor room health and SFU connectivity"""
        try:
            room_data = cls.get_room_by_id(room_id)
            if not room_data:
                return {'success': False, 'error': 'Room not found'}

            health_info = {
                'room_id': room_id,
                'room_mode': room_data.get('room_mode', 'p2p'),
                'participant_count': len(room_data.get('participants', [])),
                'sfu_enabled': room_data.get('sfu_enabled', False),
                'is_healthy': True,
                'issues': []
            }

            # Check SFU health if SFU is enabled
            if room_data.get('sfu_enabled') and room_data.get('sfu_room_id'):
                try:
                    from .sfu_client import SFUClient
                    sfu_client = SFUClient()

                    # Check if SFU room exists by getting room info
                    # Use get_room instead of get_room_stats as stats endpoint may not exist
                    sfu_room_info = sfu_client.get_room(room_data['sfu_room_id'])

                    # Check if we got an error response
                    if isinstance(sfu_room_info, dict) and 'error' in sfu_room_info:
                        health_info['is_healthy'] = False
                        error_msg = sfu_room_info.get('error', 'Unknown error')
                        health_info['issues'].append(f"SFU room error: {error_msg}")
                    # Check if room exists - successful response should have room_id
                    elif not isinstance(sfu_room_info, dict) or not sfu_room_info.get('room_id'):
                        health_info['is_healthy'] = False
                        health_info['issues'].append("SFU room exists but missing room_id in response")
                    # Room exists and is healthy
                    else:
                        # SFU room is healthy, no issues
                        pass

                except Exception as e:
                    health_info['is_healthy'] = False
                    health_info['issues'].append(f"SFU communication error: {str(e)}")

            return {'success': True, 'health': health_info}

        except Exception as e:
            logger.error(f"Room health monitoring error for {room_id}: {e}")
            return {'success': False, 'error': str(e)}

    @classmethod
    def check_sfu_threshold(cls, room_id):
        """Check if room should switch to SFU mode based on participant count"""
        room_data = cls.get_room_by_id(room_id)
        if not room_data:
            return False

        current_participants = len(room_data.get('participants', []))
        sfu_threshold = getattr(settings, 'ROOM_SETTINGS', {}).get('sfu_required_threshold', 3)

        # Check if we need to switch to SFU mode
        if (current_participants >= sfu_threshold and
            not room_data.get('sfu_enabled', False) and
            not room_data.get('participant_threshold_reached', False)):

            # Check if fallback to P2P is disabled
            fallback_enabled = getattr(settings, 'ROOM_SETTINGS', {}).get('fallback_to_p2p', True)
            if not fallback_enabled:
                # If fallback is disabled, don't proceed with SFU creation
                logger.warning(f"Room {room_id} reached threshold but fallback disabled, keeping P2P mode")
                return False

            room_data['participant_threshold_reached'] = True

            # Update room data
            cache = cls._get_redis_client()
            cache.set(
                f'room_{room_id}',
                room_data,
                timeout=getattr(settings, 'ROOM_EXPIRY_HOURS', 24) * 3600
            )

            logger.info(f"Room {room_id} reached SFU threshold ({current_participants}/{sfu_threshold})")
            return True

        return False

    @classmethod
    def get_room_sfu_info(cls, room_id):
        """Get SFU information for a room"""
        room_data = cls.get_room_by_id(room_id)
        if not room_data:
            return None

        return {
            'sfu_enabled': room_data.get('sfu_enabled', False),
            'sfu_room_id': room_data.get('sfu_room_id'),
            'sfu_ws_url': room_data.get('sfu_url'),
            'room_mode': room_data.get('room_mode', 'p2p')
        }

    @classmethod
    def cleanup_expired_rooms(cls):
        """Clean up expired rooms (to be called by scheduled task)"""
        # This would typically be implemented as a management command
        # or scheduled task using Django-Q or Celery
        pass


# Database Models for Analytics and Admin Panel

class RoomAnalytics(models.Model):
    """
    Model for storing room analytics and statistics.
    Used for admin dashboard and reporting.
    """

    PERIOD_CHOICES = [
        ('hourly', 'Hourly'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period = models.CharField(max_length=20, choices=PERIOD_CHOICES, default='daily')
    period_start = models.DateTimeField(db_index=True)
    period_end = models.DateTimeField()

    # Room statistics
    total_rooms_created = models.PositiveIntegerField(default=0)
    total_rooms_active = models.PositiveIntegerField(default=0)
    total_rooms_expired = models.PositiveIntegerField(default=0)

    # Participant statistics
    total_participants = models.PositiveIntegerField(default=0)
    unique_participants = models.PositiveIntegerField(default=0)
    avg_participants_per_room = models.FloatField(default=0.0)
    max_participants_in_room = models.PositiveIntegerField(default=0)

    # Duration statistics (in seconds)
    total_session_duration = models.PositiveIntegerField(default=0)
    avg_session_duration = models.PositiveIntegerField(default=0)
    longest_session = models.PositiveIntegerField(default=0)

    # SFU usage statistics
    sfu_rooms_created = models.PositiveIntegerField(default=0)
    sfu_rooms_failed = models.PositiveIntegerField(default=0)
    p2p_rooms_used = models.PositiveIntegerField(default=0)

    # Geographic data (if available)
    top_countries = models.JSONField(default=dict, blank=True)
    top_cities = models.JSONField(default=dict, blank=True)

    # Technical metrics
    connection_errors = models.PositiveIntegerField(default=0)
    avg_connection_time = models.FloatField(default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-period_start']
        indexes = [
            models.Index(fields=['period', 'period_start']),
            models.Index(fields=['period_start', 'period_end']),
        ]
        unique_together = ['period', 'period_start']
        verbose_name = "Room Analytics"
        verbose_name_plural = "Room Analytics"

    def __str__(self):
        return f"{self.get_period_display()} - {self.period_start.strftime('%Y-%m-%d')}"

    @property
    def success_rate(self):
        """Calculate SFU success rate percentage"""
        total_sfu_attempts = self.sfu_rooms_created + self.sfu_rooms_failed
        if total_sfu_attempts == 0:
            return 0.0
        return (self.sfu_rooms_created / total_sfu_attempts) * 100


class SystemMetrics(models.Model):
    """
    Model for storing system-wide metrics and performance data.
    Used for monitoring system health and performance.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Timing
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    # Server metrics
    cpu_usage = models.FloatField(default=0.0)  # Percentage
    memory_usage = models.FloatField(default=0.0)  # Percentage
    disk_usage = models.FloatField(default=0.0)  # Percentage

    # Network metrics
    network_in = models.BigIntegerField(default=0)  # Bytes
    network_out = models.BigIntegerField(default=0)  # Bytes
    active_connections = models.PositiveIntegerField(default=0)

    # Database metrics
    db_connections = models.PositiveIntegerField(default=0)
    db_query_time_avg = models.FloatField(default=0.0)  # Milliseconds

    # Redis metrics
    redis_connections = models.PositiveIntegerField(default=0)
    redis_memory_used = models.BigIntegerField(default=0)  # Bytes
    redis_keys_count = models.PositiveIntegerField(default=0)

    # Application metrics
    active_rooms = models.PositiveIntegerField(default=0)
    total_participants = models.PositiveIntegerField(default=0)
    websocket_connections = models.PositiveIntegerField(default=0)

    # Error metrics
    errors_500 = models.PositiveIntegerField(default=0)
    errors_400 = models.PositiveIntegerField(default=0)
    timeout_errors = models.PositiveIntegerField(default=0)

    # Performance metrics
    response_time_avg = models.FloatField(default=0.0)  # Milliseconds
    requests_per_second = models.FloatField(default=0.0)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['cpu_usage', 'memory_usage']),
        ]
        verbose_name = "System Metrics"
        verbose_name_plural = "System Metrics"

    def __str__(self):
        return f"Metrics - {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"


class UserActivityLog(models.Model):
    """
    Model for logging user activities and admin actions.
    Used for audit trails and security monitoring.
    """

    ACTION_CHOICES = [
        ('login', 'User Login'),
        ('logout', 'User Logout'),
        ('room_create', 'Room Created'),
        ('room_join', 'Room Joined'),
        ('room_leave', 'Room Left'),
        ('room_close', 'Room Closed'),
        ('user_create', 'User Created'),
        ('user_update', 'User Updated'),
        ('user_delete', 'User Deleted'),
        ('user_suspend', 'User Suspended'),
        ('system_config', 'System Configuration Changed'),
        ('analytics_view', 'Analytics Viewed'),
    ]

    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # User information
    user = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs'
    )
    user_email = models.EmailField()  # Store email for cases where user is deleted

    # Activity details
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='low')

    # Context information
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    session_key = models.CharField(max_length=40, blank=True)

    # Related objects (for polymorphic relationships)
    content_type = models.ForeignKey(
        'contenttypes.ContentType',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    object_id = models.UUIDField(null=True, blank=True)
    object_description = models.CharField(max_length=255, blank=True)

    # Additional metadata
    metadata = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True)

    # Timing
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
            models.Index(fields=['severity', 'timestamp']),
            models.Index(fields=['ip_address', 'timestamp']),
            models.Index(fields=['content_type', 'object_id']),
        ]
        verbose_name = "User Activity Log"
        verbose_name_plural = "User Activity Logs"

    def __str__(self):
        return f"{self.user_email} - {self.get_action_display()} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"

    def save(self, *args, **kwargs):
        """Ensure user_email is set"""
        if self.user and not self.user_email:
            self.user_email = self.user.email
        super().save(*args, **kwargs)
