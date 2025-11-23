"""
Tests for authentication views - UserManagementViewSet, UserActivityViewSet, and JWT views
"""
import pytest
import json
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from faker import Faker

User = get_user_model()
fake = Faker()


@pytest.mark.api
@pytest.mark.django_db(transaction=True)
class UserManagementViewSetTestCase(APITestCase):
    """Test UserManagementViewSet API endpoints"""

    @pytest.fixture(autouse=True, scope='function')
    def setup_db(self, transactional_db):
        """Set up test data with database access"""
        # Create admin user
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='adminpass123',
            role='admin',
            is_staff=True
        )
        
        # Create moderator user
        self.moderator = User.objects.create_user(
            email='mod@test.com',
            password='modpass123',
            role='moderator'
        )
        
        # Create regular user
        self.user = User.objects.create_user(
            email='user@test.com',
            password='userpass123',
            role='user'
        )
        yield
        # Cleanup is handled by pytest-django's transactional_db

    def test_list_users_as_admin(self):
        """Test listing users as admin"""
        self.client.force_authenticate(user=self.admin)
        url = '/api/auth/users/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check if response is paginated or a list
        if isinstance(response.data, dict) and 'results' in response.data:
            self.assertGreaterEqual(len(response.data['results']), 3)  # At least 3 users
        else:
            self.assertGreaterEqual(len(response.data), 3)  # At least 3 users
    def test_list_users_as_moderator(self):
        """Test listing users as moderator (should only see regular users)"""
        self.client.force_authenticate(user=self.moderator)
        url = '/api/auth/users/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Moderator should only see regular users, not admins/moderators
        data = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        user_roles = [u['role'] for u in data]
        self.assertNotIn('admin', user_roles)
        self.assertNotIn('moderator', user_roles)
    def test_list_users_as_regular_user(self):
        """Test listing users as regular user (should be forbidden)"""
        self.client.force_authenticate(user=self.user)
        url = '/api/auth/users/'
        
        response = self.client.get(url)
        
        # Regular users should not be able to list users
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED])
    def test_create_user_as_admin(self):
        """Test creating user as admin"""
        self.client.force_authenticate(user=self.admin)
        url = '/api/auth/users/'
        data = {
            'email': 'newuser@test.com',
            'password': 'newpass123',
            'role': 'user',
            'first_name': 'New',
            'last_name': 'User'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['email'], 'newuser@test.com')
        
        # Verify user was created in database
        created_user = User.objects.get(email='newuser@test.com')
        self.assertIsNotNone(created_user)
    def test_create_user_as_moderator(self):
        """Test creating user as moderator (should be forbidden)"""
        self.client.force_authenticate(user=self.moderator)
        url = '/api/auth/users/'
        data = {
            'email': 'newuser2@test.com',
            'password': 'newpass123',
            'role': 'user'
        }
        
        response = self.client.post(url, data, format='json')
        
        # Moderators should not be able to create users
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED])
    def test_retrieve_user(self):
        """Test retrieving user details"""
        self.client.force_authenticate(user=self.admin)
        url = f'/api/auth/users/{self.user.id}/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.user.email)
    def test_update_user_as_admin(self):
        """Test updating user as admin"""
        self.client.force_authenticate(user=self.admin)
        url = f'/api/auth/users/{self.user.id}/'
        data = {
            'email': self.user.email,
            'first_name': 'Updated',
            'last_name': 'Name'
        }
        
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], 'Updated')
        
        # Verify update in database
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Updated')
    def test_suspend_user(self):
        """Test suspending a user"""
        self.client.force_authenticate(user=self.admin)
        url = f'/api/auth/admin/users/suspend/{self.user.id}/'
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        
        # Verify user is suspended
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
    def test_reactivate_user(self):
        """Test reactivating a suspended user"""
        # First suspend the user
        self.user.is_active = False
        self.user.save()
        
        self.client.force_authenticate(user=self.admin)
        url = f'/api/auth/admin/users/reactivate/{self.user.id}/'
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify user is reactivated
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
    def test_delete_user_soft_delete(self):
        """Test soft delete (deactivate) user"""
        self.client.force_authenticate(user=self.admin)
        url = f'/api/auth/users/{self.user.id}/'
        
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify user is deactivated (soft delete)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)


@pytest.mark.api
@pytest.mark.django_db(transaction=True)
class UserActivityViewSetTestCase(APITestCase):
    """Test UserActivityViewSet API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_db(self, transactional_db):
        """Set up test data with database access"""
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='adminpass123',
            role='admin',
            is_staff=True
        )
        
        from apps.core.models import UserActivityLog
        # Create some activity logs
        self.activity1 = UserActivityLog.objects.create(
            user=self.admin,
            action='login',
            severity='low',
            ip_address='127.0.0.1'
        )
        self.activity2 = UserActivityLog.objects.create(
            user=self.admin,
            action='logout',
            severity='low',
            ip_address='127.0.0.1'
        )
        yield
    def test_list_activity_logs(self):
        """Test listing activity logs"""
        self.client.force_authenticate(user=self.admin)
        url = '/api/auth/activity/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 2)
    def test_recent_activity(self):
        """Test getting recent activity"""
        self.client.force_authenticate(user=self.admin)
        url = '/api/auth/activity/recent/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertGreaterEqual(len(response.data), 2)


@pytest.mark.api
@pytest.mark.django_db(transaction=True)
class JWTViewsTestCase(APITestCase):
    """Test JWT authentication views"""
    
    @pytest.fixture(autouse=True)
    def setup_db(self, transactional_db):
        """Set up test data with database access"""
        self.user = User.objects.create_user(
            email='jwtuser@test.com',
            password='jwtpass123',
            role='user'
        )
        
        self.admin = User.objects.create_user(
            email='jwtadmin@test.com',
            password='jwtadmin123',
            role='admin',
            is_staff=True
        )
        yield
        yield
    def test_admin_login_view(self):
        """Test AdminLoginView"""
        from apps.authentication.views import AdminLoginView
        from rest_framework_simplejwt.views import TokenObtainPairView
        
        # Verify AdminLoginView is a subclass of TokenObtainPairView
        self.assertTrue(issubclass(AdminLoginView, TokenObtainPairView))
    def test_cookie_token_obtain_pair(self):
        """Test CookieTokenObtainPairView"""
        url = '/api/auth/token/'
        data = {
            'email': self.user.email,
            'password': 'jwtpass123'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should set httpOnly cookies
        self.assertIn('access_token', response.cookies)
        self.assertIn('refresh_token', response.cookies)
    def test_cookie_token_refresh(self):
        """Test CookieTokenRefreshView"""
        # First get tokens
        url = '/api/auth/token/'
        data = {
            'email': self.user.email,
            'password': 'jwtpass123'
        }
        response = self.client.post(url, data, format='json')
        refresh_token = response.cookies['refresh_token'].value
        
        # Refresh token
        refresh_url = '/api/auth/token/refresh/'
        response = self.client.post(refresh_url, {'refresh': refresh_token}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', response.cookies)
    def test_cookie_logout(self):
        """Test cookie logout view"""
        # First login
        url = '/api/auth/token/'
        data = {
            'email': self.user.email,
            'password': 'jwtpass123'
        }
        self.client.post(url, data, format='json')
        
        # Logout
        logout_url = '/api/auth/logout/'
        response = self.client.post(logout_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Cookies should be cleared
        self.assertIn('access_token', response.cookies)
        self.assertIn('refresh_token', response.cookies)

    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        url = '/api/auth/admin/login/'
        data = {
            'email': self.admin.email,
            'password': 'wrongpassword'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)

    def test_admin_login_inactive_user(self):
        """Test admin login with inactive user"""
        self.admin.is_active = False
        self.admin.save()
        
        url = '/api/auth/admin/login/'
        data = {
            'email': self.admin.email,
            'password': 'jwtadmin123'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)

    def test_admin_login_regular_user(self):
        """Test admin login with regular user (should fail)"""
        url = '/api/auth/admin/login/'
        data = {
            'email': self.user.email,
            'password': 'jwtpass123'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error', response.data)

    def test_check_auth_view(self):
        """Test check auth view"""
        self.client.force_authenticate(user=self.user)
        url = '/api/auth/check/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('authenticated', response.data)

    def test_user_stats(self):
        """Test user stats endpoint"""
        self.client.force_authenticate(user=self.admin)
        url = '/api/auth/stats/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_users', response.data)

    def test_session_info(self):
        """Test session info endpoint"""
        self.client.force_authenticate(user=self.user)
        url = '/api/auth/session/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)

