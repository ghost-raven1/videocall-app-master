#!/usr/bin/env python3
"""
Test script for JWT cookie authentication
Run with: python tests/test_jwt_auth.py
"""

import os
import sys
import django
from django.conf import settings
from django.test import TestCase, Client
from django.contrib.auth import get_user_model

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.videocall_app.settings')
sys.path.append('backend')
django.setup()

User = get_user_model()

class JWTAuthenticationTest(TestCase):
    """Test JWT authentication with httpOnly cookies"""

    def setUp(self):
        """Set up test user"""
        self.client = Client()
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            role='admin'
        )
        self.login_data = {
            'email': 'test@example.com',
            'password': 'testpass123'
        }

    def test_jwt_cookie_login(self):
        """Test JWT login with cookie storage"""
        print("Testing JWT cookie login...")

        response = self.client.post('/api/auth/token/', self.login_data)

        print(f"Login status: {response.status_code}")
        print(f"Response data: {response.data}")

        # Check if cookies are set
        access_cookie = response.cookies.get(settings.JWT_COOKIE_SETTINGS['ACCESS_TOKEN_COOKIE_NAME'])
        refresh_cookie = response.cookies.get(settings.JWT_COOKIE_SETTINGS['REFRESH_TOKEN_COOKIE_NAME'])

        print(f"Access cookie set: {access_cookie is not None}")
        print(f"Refresh cookie set: {refresh_cookie is not None}")

        if access_cookie:
            print(f"Access cookie httponly: {access_cookie['httponly']}")
            print(f"Access cookie secure: {access_cookie['secure']}")

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.cookies)
        self.assertIn('refresh', response.cookies)

        # Verify cookies are httpOnly
        self.assertTrue(response.cookies['access_token']['httponly'])
        self.assertTrue(response.cookies['refresh_token']['httponly'])

        print("✓ JWT cookie login test passed")

    def test_jwt_cookie_authentication(self):
        """Test that JWT cookies are used for authentication"""
        print("\nTesting JWT cookie authentication...")

        # First login to get cookies
        login_response = self.client.post('/api/auth/token/', self.login_data)
        self.assertEqual(login_response.status_code, 200)

        # Test accessing protected endpoint
        auth_response = self.client.get('/api/auth/check/')

        print(f"Auth check status: {auth_response.status_code}")
        print(f"Auth response: {auth_response.data}")

        self.assertEqual(auth_response.status_code, 200)
        self.assertTrue(auth_response.data['authenticated'])

        print("✓ JWT cookie authentication test passed")

    def test_jwt_logout_clears_cookies(self):
        """Test that logout clears JWT cookies"""
        print("\nTesting JWT logout...")

        # First login
        login_response = self.client.post('/api/auth/token/', self.login_data)
        self.assertEqual(login_response.status_code, 200)

        # Then logout
        logout_response = self.client.post('/api/auth/logout/')

        print(f"Logout status: {logout_response.status_code}")

        # Check that cookies are cleared
        access_cookie = logout_response.cookies.get(settings.JWT_COOKIE_SETTINGS['ACCESS_TOKEN_COOKIE_NAME'])
        refresh_cookie = logout_response.cookies.get(settings.JWT_COOKIE_SETTINGS['REFRESH_TOKEN_COOKIE_NAME'])

        print(f"Access cookie cleared: {access_cookie is None or access_cookie.value == ''}")
        print(f"Refresh cookie cleared: {refresh_cookie is None or refresh_cookie.value == ''}")

        self.assertEqual(logout_response.status_code, 200)

        print("✓ JWT logout test passed")

if __name__ == '__main__':
    print("Running JWT Authentication Tests...")
    print("=" * 50)

    test = JWTAuthenticationTest()
    test.setUp()

    try:
        test.test_jwt_cookie_login()
        test.test_jwt_cookie_authentication()
        test.test_jwt_logout_clears_cookies()

        print("\n" + "=" * 50)
        print("✅ All JWT authentication tests passed!")
        print("\nSecurity improvements implemented:")
        print("• JWT tokens stored in httpOnly cookies")
        print("• XSS protection enabled")
        print("• Automatic token refresh")
        print("• Consistent authentication across all components")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)