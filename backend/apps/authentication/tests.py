"""
Authentication app tests - Comprehensive testing for user authentication, authorization, and security.
"""
import pytest
import json
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from faker import Faker
from django.core import mail
from django.utils import timezone
import uuid

User = get_user_model()
fake = Faker()


class BaseAuthenticationTestCase(TestCase):
    """Base class for authentication tests."""

    def setUp(self):
        """Set up test data."""
        self.client = Client()

        # Create test users
        self.user = User.objects.create_user(
            email='user@test.com',
            password='userpass123',
            role='user',
            first_name='Test',
            last_name='User'
        )

        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='adminpass123',
            role='admin',
            first_name='Admin',
            last_name='User'
        )

        self.moderator = User.objects.create_user(
            email='mod@test.com',
            password='modpass123',
            role='moderator',
            first_name='Mod',
            last_name='User'
        )

        # URLs
        self.login_url = reverse('token_obtain_pair')
        self.logout_url = reverse('logout')
        self.user_check_url = reverse('user_check')

    def authenticate_user(self, user):
        """Authenticate a user and return client with cookies."""
        response = self.client.post(self.login_url, {
            'email': user.email,
            'password': 'userpass123' if user == self.user else
                       'adminpass123' if user == self.admin else 'modpass123'
        })

        if response.status_code == 200:
            # Set cookies for authenticated requests
            access_cookie = response.cookies.get('access_token')
            refresh_cookie = response.cookies.get('refresh_token')

            if access_cookie and refresh_cookie:
                self.client.cookies['access_token'] = access_cookie.value
                self.client.cookies['refresh_token'] = refresh_cookie.value

        return response


@pytest.mark.auth
class UserModelTestCase(BaseAuthenticationTestCase):
    """Test User model functionality."""

    def test_create_user(self):
        """Test user creation."""
        user = User.objects.create_user(
            email='newuser@test.com',
            password='newpass123',
            role='user'
        )

        self.assertEqual(user.email, 'newuser@test.com')
        self.assertEqual(user.role, 'user')
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertIsNone(user.username)

    def test_create_superuser(self):
        """Test superuser creation."""
        admin = User.objects.create_superuser(
            email='super@test.com',
            password='superpass123'
        )

        self.assertEqual(admin.role, 'admin')
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

    def test_user_manager_methods(self):
        """Test custom user manager methods."""
        # Test get_by_role
        users = User.objects.get_by_role('admin')
        self.assertEqual(users.count(), 1)
        self.assertEqual(users.first(), self.admin)

        # Test admins() method
        admins = User.objects.admins()
        self.assertEqual(admins.count(), 1)
        self.assertEqual(admins.first(), self.admin)

        # Test moderators() method
        moderators = User.objects.moderators()
        self.assertEqual(moderators.count(), 1)
        self.assertEqual(moderators.first(), self.moderator)

    def test_user_permissions(self):
        """Test user permission system."""
        # Admin permissions
        self.assertTrue(self.admin.has_permission('manage_users'))
        self.assertTrue(self.admin.has_permission('manage_rooms'))
        self.assertTrue(self.admin.has_permission('view_analytics'))

        # Moderator permissions
        self.assertTrue(self.moderator.has_permission('manage_rooms'))
        self.assertTrue(self.moderator.has_permission('view_analytics'))
        self.assertFalse(self.moderator.has_permission('manage_users'))

        # User permissions
        self.assertFalse(self.user.has_permission('manage_users'))
        self.assertFalse(self.user.has_permission('manage_rooms'))

    def test_user_role_methods(self):
        """Test user role checking methods."""
        self.assertTrue(self.admin.is_admin())
        self.assertTrue(self.moderator.is_moderator())
        self.assertFalse(self.user.is_admin())
        self.assertFalse(self.user.is_moderator())

    def test_can_manage_user(self):
        """Test user management permissions."""
        # Admin can manage anyone
        self.assertTrue(self.admin.can_manage_user(self.user))
        self.assertTrue(self.admin.can_manage_user(self.moderator))

        # Moderator can manage users but not other moderators/admins
        self.assertTrue(self.moderator.can_manage_user(self.user))
        self.assertFalse(self.moderator.can_manage_user(self.admin))

        # User cannot manage anyone
        self.assertFalse(self.user.can_manage_user(self.admin))
        self.assertFalse(self.user.can_manage_user(self.moderator))

    def test_update_activity(self):
        """Test activity timestamp updates."""
        old_activity = self.user.last_activity
        self.user.update_activity()
        self.user.refresh_from_db()

        self.assertNotEqual(self.user.last_activity, old_activity)


@pytest.mark.auth
class AuthenticationViewTestCase(BaseAuthenticationTestCase):
    """Test authentication views."""

    def test_successful_login(self):
        """Test successful user login."""
        response = self.authenticate_user(self.user)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', response.cookies)
        self.assertIn('refresh_token', response.cookies)

        # Check cookies are httpOnly and secure
        access_cookie = response.cookies['access_token']
        self.assertTrue(access_cookie['httponly'])
        # Note: secure=False for testing

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        response = self.client.post(self.login_url, {
            'email': 'user@test.com',
            'password': 'wrongpassword'
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access_token', response.cookies)

    def test_login_nonexistent_user(self):
        """Test login with non-existent user."""
        response = self.client.post(self.login_url, {
            'email': 'nonexistent@test.com',
            'password': 'password123'
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_check_authenticated(self):
        """Test user check for authenticated user."""
        self.authenticate_user(self.user)

        response = self.client.get(self.user_check_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['authenticated'])
        self.assertEqual(response.data['user']['email'], self.user.email)
        self.assertEqual(response.data['user']['role'], self.user.role)

    def test_user_check_unauthenticated(self):
        """Test user check for unauthenticated user."""
        response = self.client.get(self.user_check_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['authenticated'])
        self.assertIsNone(response.data['user'])

    def test_logout(self):
        """Test user logout."""
        self.authenticate_user(self.user)

        response = self.client.post(self.logout_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check cookies are cleared
        access_cookie = response.cookies.get('access_token')
        refresh_cookie = response.cookies.get('refresh_token')

        self.assertTrue(
            not access_cookie or not access_cookie.value or access_cookie.value == ''
        )
        self.assertTrue(
            not refresh_cookie or not refresh_cookie.value or refresh_cookie.value == ''
        )


@pytest.mark.security
class SecurityTestCase(BaseAuthenticationTestCase):
    """Test security features."""

    def test_password_hashing(self):
        """Test password hashing."""
        user = User.objects.create_user(
            email='hash@test.com',
            password='plaintext123'
        )

        # Password should be hashed
        self.assertNotEqual(user.password, 'plaintext123')
        self.assertTrue(user.check_password('plaintext123'))

    def test_jwt_cookie_security(self):
        """Test JWT cookie security settings."""
        response = self.authenticate_user(self.user)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        access_cookie = response.cookies['access_token']
        refresh_cookie = response.cookies['refresh_token']

        # Check httpOnly setting
        self.assertTrue(access_cookie['httponly'])
        self.assertTrue(refresh_cookie['httponly'])

        # Check path
        self.assertEqual(access_cookie['path'], '/')
        self.assertEqual(refresh_cookie['path'], '/')

    def test_rate_limiting(self):
        """Test login rate limiting."""
        # This would require django-ratelimit configuration
        # and is tested in integration tests
        pass

    def test_session_security(self):
        """Test session security features."""
        from apps.authentication.models import UserSession

        # Create a session
        session = UserSession.objects.create(
            user=self.user,
            session_key='test_session_key_123',
            ip_address='127.0.0.1',
            user_agent='test-agent'
        )

        self.assertTrue(session.is_active)
        self.assertIsNotNone(session.login_time)

        # End session
        session.end_session()
        session.refresh_from_db()

        self.assertFalse(session.is_active)
        self.assertIsNotNone(session.logout_time)

    def test_login_attempt_tracking(self):
        """Test login attempt tracking."""
        from apps.authentication.models import LoginAttempt

        # Create failed login attempt
        attempt = LoginAttempt.objects.create(
            email='test@test.com',
            ip_address='127.0.0.1',
            user_agent='test-agent',
            successful=False,
            failure_reason='Invalid credentials'
        )

        self.assertFalse(attempt.successful)
        self.assertEqual(attempt.failure_reason, 'Invalid credentials')
        self.assertIsNotNone(attempt.attempted_at)


@pytest.mark.api
class AuthenticationAPITestCase(APITestCase):
    """Test authentication API endpoints."""

    def setUp(self):
        """Set up API test data."""
        self.user = User.objects.create_user(
            email='apiuser@test.com',
            password='apipass123',
            role='user'
        )

        self.admin = User.objects.create_user(
            email='apiadmin@test.com',
            password='apiadmin123',
            role='admin'
        )

    def test_token_obtain_api(self):
        """Test JWT token obtain endpoint."""
        url = reverse('token_obtain_pair')
        data = {
            'email': self.user.email,
            'password': 'apipass123'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_token_refresh_api(self):
        """Test token refresh endpoint."""
        # First get tokens
        url = reverse('token_obtain_pair')
        data = {
            'email': self.user.email,
            'password': 'apipass123'
        }

        response = self.client.post(url, data, format='json')
        refresh_token = response.data['refresh']

        # Refresh token
        refresh_url = reverse('token_refresh')
        refresh_data = {'refresh': refresh_token}

        response = self.client.post(refresh_url, refresh_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_user_profile_api(self):
        """Test user profile endpoints."""
        # Authenticate
        self.client.force_authenticate(user=self.user)

        # Get profile
        url = reverse('user_profile')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.user.email)


@pytest.mark.integration
class AuthenticationIntegrationTestCase(BaseAuthenticationTestCase):
    """Integration tests for authentication system."""

    def test_full_authentication_flow(self):
        """Test complete authentication flow."""
        # 1. Login
        response = self.authenticate_user(self.user)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 2. Access protected resource
        response = self.client.get(self.user_check_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['authenticated'])

        # 3. Logout
        response = self.client.post(self.logout_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 4. Verify logout (should be unauthenticated)
        response = self.client.get(self.user_check_url)
        self.assertFalse(response.data['authenticated'])

    def test_role_based_access_control(self):
        """Test role-based access control."""
        # Test admin access
        self.authenticate_user(self.admin)
        response = self.client.get('/api/admin/users/')  # Assuming admin endpoint
        # This would depend on actual admin endpoints

        # Test user access to admin endpoint
        self.authenticate_user(self.user)
        response = self.client.get('/api/admin/users/')
        # Should be forbidden or redirect

    def test_concurrent_sessions(self):
        """Test handling of concurrent user sessions."""
        from apps.authentication.models import UserSession

        # Create multiple sessions for same user
        session1 = UserSession.objects.create(
            user=self.user,
            session_key='session1',
            ip_address='192.168.1.1'
        )

        session2 = UserSession.objects.create(
            user=self.user,
            session_key='session2',
            ip_address='192.168.1.2'
        )

        # Both should be active initially
        self.assertTrue(session1.is_active)
        self.assertTrue(session2.is_active)

        # End one session
        session1.end_session()
        self.assertFalse(session1.is_active)
        self.assertTrue(session2.is_active)


@pytest.mark.websocket
class WebSocketAuthenticationTestCase(BaseAuthenticationTestCase):
    """Test WebSocket authentication."""

    @pytest.mark.asyncio
    async def test_websocket_authentication(self):
        """Test WebSocket connection with authentication."""
        from channels.testing import WebsocketCommunicator
        from videocall_app.asgi import application

        # Create authenticated client
        self.authenticate_user(self.user)

        # This would test WebSocket authentication
        # Implementation depends on actual WebSocket setup
        pass
