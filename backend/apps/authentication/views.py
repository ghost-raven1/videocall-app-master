# authentication/views.py - JWT Authentication and User Management API views
import logging
from django.utils import timezone
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django_ratelimit.decorators import ratelimit
from .authentication import CookieJWTAuthentication
from django.core.exceptions import ValidationError as DjangoValidationError
from django.conf import settings
from django.http import HttpResponse
from .models import User, UserProfile, UserSession, LoginAttempt
from apps.core.models import SystemSettings
from apps.rooms.models import UserActivityLog

# Import SSO views
from . import sso_views


logger = logging.getLogger(__name__)


def get_client_ip(request):
    """Extract client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


class AdminLoginView(TokenObtainPairView):
    """Enhanced login view with activity logging and session tracking"""

    # Disable throttling for this view
    throttle_classes = []

    def check_throttles(self, request):
        """Override to skip throttling check"""
        pass

    def post(self, request, *args, **kwargs):
        try:
            # Get login credentials
            email = request.data.get('email', '').lower()
            password = request.data.get('password')

            if not email or not password:
                return Response(
                    {'error': 'Email and password are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Authenticate user
            user = User.objects.filter(email=email).first()

            if not user or not user.check_password(password):
                # Log failed attempt
                LoginAttempt.objects.create(
                    email=email,
                    ip_address=get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    successful=False,
                    failure_reason='Invalid credentials'
                )
                logger.warning(f"Failed login attempt for {email} from IP: {get_client_ip(request)}")
                return Response(
                    {'error': 'Invalid credentials'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            if not user.is_active:
                LoginAttempt.objects.create(
                    email=email,
                    ip_address=get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    successful=False,
                    failure_reason='Account disabled'
                )
                return Response(
                    {'error': 'Account is disabled'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # Check if user has admin or moderator role
            if not user.is_admin() and not user.is_moderator():
                LoginAttempt.objects.create(
                    email=email,
                    ip_address=get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    successful=False,
                    failure_reason='Insufficient permissions'
                )
                return Response(
                    {'error': 'Admin or moderator access required'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Log successful attempt
            LoginAttempt.objects.create(
                email=email,
                ip_address=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                successful=True
            )

            # Update user activity
            user.update_activity()

            # Create session record
            UserSession.objects.create(
                user=user,
                session_key=request.session.session_key or 'jwt-auth',
                ip_address=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )

            logger.info(f"Successful admin login for {email} from IP: {get_client_ip(request)}")

            # Get tokens using parent class
            response = super().post(request, *args, **kwargs)

            if response.status_code == 200:
                # Add user info to response
                response.data.update({
                    'user': {
                        'id': str(user.id),
                        'email': user.email,
                        'role': user.role,
                        'is_active': user.is_active,
                    }
                })

            return response

        except Exception as e:
            logger.error(f"Login error: {e}")
            return Response(
                {'error': 'Authentication failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CookieTokenObtainPairView(TokenObtainPairView):
    """
    JWT authentication view that stores tokens in httpOnly cookies for security
    """

    def post(self, request, *args, **kwargs):
        # Get the default token response
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            # Extract tokens from response data
            access_token = response.data.get('access')
            refresh_token = response.data.get('refresh')

            if access_token and refresh_token:
                # Create new response with cookies instead of tokens in body
                cookie_response = Response({
                    'message': 'Login successful',
                    'user': response.data.get('user', {})
                })

                # Set httpOnly cookies for JWT tokens
                cookie_settings = settings.JWT_COOKIE_SETTINGS

                # Access token cookie
                cookie_response.set_cookie(
                    cookie_settings['ACCESS_TOKEN_COOKIE_NAME'],
                    access_token,
                    max_age=settings.JWT_CONFIG['ACCESS_TOKEN_LIFETIME'].total_seconds(),
                    httponly=cookie_settings['ACCESS_TOKEN_COOKIE_HTTPONLY'],
                    secure=cookie_settings['ACCESS_TOKEN_COOKIE_SECURE'],
                    samesite=cookie_settings['ACCESS_TOKEN_COOKIE_SAMESITE'],
                    path=cookie_settings['ACCESS_TOKEN_COOKIE_PATH']
                )

                # Refresh token cookie
                cookie_response.set_cookie(
                    cookie_settings['REFRESH_TOKEN_COOKIE_NAME'],
                    refresh_token,
                    max_age=settings.JWT_CONFIG['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                    httponly=cookie_settings['REFRESH_TOKEN_COOKIE_HTTPONLY'],
                    secure=cookie_settings['REFRESH_TOKEN_COOKIE_SECURE'],
                    samesite=cookie_settings['REFRESH_TOKEN_COOKIE_SAMESITE'],
                    path=cookie_settings['REFRESH_TOKEN_COOKIE_PATH']
                )

                return cookie_response

        return response


class CookieTokenRefreshView(TokenRefreshView):
    """
    JWT token refresh view that updates httpOnly cookies
    """

    def post(self, request, *args, **kwargs):
        # Get refresh token from cookie
        refresh_token = request.COOKIES.get(settings.JWT_COOKIE_SETTINGS['REFRESH_TOKEN_COOKIE_NAME'])

        if not refresh_token:
            return Response(
                {'error': 'No refresh token found'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Add refresh token to request data
        request.data['refresh'] = refresh_token

        # Get the default token response
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            # Extract new tokens
            new_access_token = response.data.get('access')
            new_refresh_token = response.data.get('refresh')

            if new_access_token:
                # Create new response with updated cookies
                cookie_response = Response({
                    'message': 'Token refreshed successfully'
                })

                cookie_settings = settings.JWT_COOKIE_SETTINGS

                # Update access token cookie
                cookie_response.set_cookie(
                    cookie_settings['ACCESS_TOKEN_COOKIE_NAME'],
                    new_access_token,
                    max_age=settings.JWT_CONFIG['ACCESS_TOKEN_LIFETIME'].total_seconds(),
                    httponly=cookie_settings['ACCESS_TOKEN_COOKIE_HTTPONLY'],
                    secure=cookie_settings['ACCESS_TOKEN_COOKIE_SECURE'],
                    samesite=cookie_settings['ACCESS_TOKEN_COOKIE_SAMESITE'],
                    path=cookie_settings['ACCESS_TOKEN_COOKIE_PATH']
                )

                # Update refresh token cookie if provided (rotation enabled)
                if new_refresh_token:
                    cookie_response.set_cookie(
                        cookie_settings['REFRESH_TOKEN_COOKIE_NAME'],
                        new_refresh_token,
                        max_age=settings.JWT_CONFIG['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                        httponly=cookie_settings['REFRESH_TOKEN_COOKIE_HTTPONLY'],
                        secure=cookie_settings['REFRESH_TOKEN_COOKIE_SECURE'],
                        samesite=cookie_settings['REFRESH_TOKEN_COOKIE_SAMESITE'],
                        path=cookie_settings['REFRESH_TOKEN_COOKIE_PATH']
                    )

                return cookie_response

        return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cookie_logout_view(request):
    """
    Logout view that clears JWT cookies
    """
    try:
        # Update session
        session = UserSession.objects.filter(
            user=request.user,
            is_active=True
        ).first()

        if session:
            session.logout_time = timezone.now()
            session.is_active = False
            session.save()

        # Create response that clears cookies
        response = Response({'message': 'Logout successful'})

        cookie_settings = settings.JWT_COOKIE_SETTINGS

        # Clear access token cookie
        response.set_cookie(
            cookie_settings['ACCESS_TOKEN_COOKIE_NAME'],
            '',
            max_age=0,
            httponly=cookie_settings['ACCESS_TOKEN_COOKIE_HTTPONLY'],
            secure=cookie_settings['ACCESS_TOKEN_COOKIE_SECURE'],
            samesite=cookie_settings['ACCESS_TOKEN_COOKIE_SAMESITE'],
            path=cookie_settings['ACCESS_TOKEN_COOKIE_PATH']
        )

        # Clear refresh token cookie
        response.set_cookie(
            cookie_settings['REFRESH_TOKEN_COOKIE_NAME'],
            '',
            max_age=0,
            httponly=cookie_settings['REFRESH_TOKEN_COOKIE_HTTPONLY'],
            secure=cookie_settings['REFRESH_TOKEN_COOKIE_SECURE'],
            samesite=cookie_settings['REFRESH_TOKEN_COOKIE_SAMESITE'],
            path=cookie_settings['REFRESH_TOKEN_COOKIE_PATH']
        )

        return response
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return Response(
            {'error': 'Logout failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class UserManagementViewSet(viewsets.ModelViewSet):
    """ViewSet for managing users (admin/moderator only)"""

    queryset = User.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return serializer class based on action"""
        from rest_framework import serializers
        
        class UserSerializer(serializers.ModelSerializer):
            """Serializer for User model"""
            class Meta:
                model = User
                fields = ['id', 'email', 'role', 'first_name', 'last_name', 'is_active', 'is_staff', 'created_at', 'updated_at', 'last_activity']
                read_only_fields = ['id', 'created_at', 'updated_at', 'last_activity']
        
        return UserSerializer

    def get_queryset(self):
        """Filter queryset based on user permissions"""
        queryset = super().get_queryset()

        # Only admins can see all users
        if not self.request.user.is_admin():
            # Moderators can only see regular users
            queryset = queryset.filter(role='user')

        return queryset

    def get_permissions(self):
        """Check permissions for different actions"""
        if self.action in ['list', 'retrieve']:
            # Any authenticated admin/moderator can view
            permission_classes = [IsAuthenticated]
        elif self.action in ['create', 'update', 'partial_update']:
            # Only admins can create/update users
            if self.request.user.is_admin():
                permission_classes = [IsAuthenticated]
            else:
                permission_classes = []
        elif self.action == 'destroy':
            # Only admins can delete users
            if self.request.user.is_admin():
                permission_classes = [IsAuthenticated]
            else:
                permission_classes = []
        else:
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

    def perform_create(self, serializer):
        """Create user with profile"""
        with transaction.atomic():
            user = serializer.save()

            # Create user profile
            UserProfile.objects.create(user=user)

            # Log user creation
            UserActivityLog.objects.create(
                user=self.request.user,
                action='user_create',
                severity='medium',
                ip_address=get_client_ip(self.request),
                metadata={'created_user_id': str(user.id)}
            )

    def perform_update(self, serializer):
        """Update user with logging"""
        old_role = self.get_object().role
        user = serializer.save()

        # Log role changes
        if old_role != user.role:
            UserActivityLog.objects.create(
                user=self.request.user,
                action='user_update',
                severity='high' if user.role == 'admin' else 'medium',
                ip_address=get_client_ip(self.request),
                content_object=user,
                metadata={'old_role': old_role, 'new_role': user.role}
            )

    def perform_destroy(self, user):
        """Soft delete user (deactivate)"""
        user.is_active = False
        user.save()

        # Log user deletion
        UserActivityLog.objects.create(
            user=self.request.user,
            action='user_delete',
            severity='high',
            ip_address=get_client_ip(self.request),
            content_object=user,
            description=f'User {user.email} was deactivated'
        )

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend a user account"""
        user = self.get_object()

        if not request.user.can_manage_user(user):
            return Response(
                {'error': 'Insufficient permissions'},
                status=status.HTTP_403_FORBIDDEN
            )

        user.is_active = False
        user.save()

        # Log suspension
        UserActivityLog.objects.create(
            user=request.user,
            action='user_suspend',
            severity='high',
            ip_address=get_client_ip(request),
            content_object=user,
            description=f'User {user.email} was suspended'
        )

        return Response({'message': 'User suspended successfully'})

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """Reactivate a suspended user"""
        user = self.get_object()

        if not request.user.can_manage_user(user):
            return Response(
                {'error': 'Insufficient permissions'},
                status=status.HTTP_403_FORBIDDEN
            )

        user.is_active = True
        user.save()

        # Log reactivation
        UserActivityLog.objects.create(
            user=request.user,
            action='user_update',
            severity='medium',
            ip_address=get_client_ip(request),
            content_object=user,
            description=f'User {user.email} was reactivated'
        )

        return Response({'message': 'User reactivated successfully'})


class UserActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing user activity and analytics"""

    queryset = UserActivityLog.objects.all().order_by('-timestamp')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter based on user permissions"""
        queryset = super().get_queryset()

        # Regular users can only see their own activity
        if not self.request.user.is_admin() and not self.request.user.is_moderator():
            queryset = queryset.filter(user=self.request.user)

        return queryset

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent user activities"""
        limit = int(request.query_params.get('limit', 50))
        queryset = self.get_queryset()[:limit]

        activities = []
        for activity in queryset:
            activities.append({
                'id': str(activity.id),
                'user': activity.user_email,
                'action': activity.get_action_display(),
                'severity': activity.severity,
                'timestamp': activity.timestamp,
                'ip_address': activity.ip_address,
            })

        return Response({
            'activities': activities,
            'total': len(activities)
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_stats(request):
    """Get user statistics for admin dashboard"""
    if not request.user.is_admin() and not request.user.is_moderator():
        return Response(
            {'error': 'Insufficient permissions'},
            status=status.HTTP_403_FORBIDDEN
        )

    stats = {
        'total_users': User.objects.count(),
        'active_users': User.objects.filter(is_active=True).count(),
        'admin_users': User.objects.filter(role='admin', is_active=True).count(),
        'moderator_users': User.objects.filter(role='moderator', is_active=True).count(),
        'recent_logins': LoginAttempt.objects.filter(
            successful=True,
            attempted_at__gte=timezone.now() - timezone.timedelta(days=7)
        ).count(),
        'failed_logins': LoginAttempt.objects.filter(
            successful=False,
            attempted_at__gte=timezone.now() - timezone.timedelta(days=7)
        ).count(),
    }

    return Response(stats)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def session_info(request):
    """Get current user session information"""
    try:
        session = UserSession.objects.filter(
            user=request.user,
            is_active=True
        ).first()

        if session:
            return Response({
                'session_id': str(session.id),
                'login_time': session.login_time,
                'last_activity': session.last_activity,
                'ip_address': session.ip_address,
                'duration_seconds': session.duration,
            })
        else:
            return Response({'message': 'No active session found'})
    except Exception as e:
        logger.error(f"Session info error: {e}")
        return Response(
            {'error': 'Failed to get session info'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Legacy login view for backward compatibility"""
    email = request.data.get('email', '').lower()
    password = request.data.get('password')

    if not email or not password:
        return Response(
            {'error': 'Email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Authenticate user
    user = User.objects.filter(email=email).first()

    if not user or not user.check_password(password):
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not user.is_active:
        return Response(
            {'error': 'Account is disabled'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # Update user activity
    user.update_activity()

    # Create session record
    UserSession.objects.create(
        user=user,
        session_key=request.session.session_key or 'legacy-auth',
        ip_address=get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', ''),
    )

    return Response({
        'message': 'Login successful',
        'user': {
            'id': str(user.id),
            'email': user.email,
            'role': user.role,
            'is_active': user.is_active,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Legacy logout view for backward compatibility"""
    try:
        # Update session
        session = UserSession.objects.filter(
            user=request.user,
            is_active=True
        ).first()

        if session:
            session.logout_time = timezone.now()
            session.is_active = False
            session.save()

        return Response({'message': 'Logout successful'})
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return Response(
            {'error': 'Logout failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_auth_view(request):
    """Check if user is authenticated"""
    return Response({
        'authenticated': True,
        'user': {
            'id': str(request.user.id),
            'email': request.user.email,
            'role': request.user.role,
            'is_active': request.user.is_active,
        }
    })


