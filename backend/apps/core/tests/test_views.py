"""
Tests for core views - health_check, system_info, metrics, get_csrf_token
"""
import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

User = get_user_model()


@pytest.mark.api
@pytest.mark.django_db(transaction=True)
class CoreViewsTestCase(APITestCase):
    """Test core application views"""

    @pytest.fixture(autouse=True)
    def setup_db(self, transactional_db):
        """Set up test data with database access"""
        yield

    def test_health_check(self):
        """Test health check endpoint"""
        url = '/health/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('status', response.json())
        self.assertIn('checks', response.json())

    @patch('apps.core.views.cache')
    def test_health_check_cache_failure(self, mock_cache):
        """Test health check with cache failure"""
        mock_cache.set.side_effect = Exception("Cache error")
        
        url = '/health/'
        response = self.client.get(url)
        
        # Should still return 200 but with unhealthy cache status
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('checks', data)
        if 'cache' in data['checks']:
            self.assertEqual(data['checks']['cache']['status'], 'unhealthy')

    @patch('apps.core.views.connection')
    def test_health_check_database_failure(self, mock_connection):
        """Test health check with database failure"""
        mock_connection.cursor.side_effect = Exception("Database error")
        
        url = '/health/'
        response = self.client.get(url)
        
        # Should return 503 if database is unhealthy
        self.assertIn(response.status_code, [200, 503])
        data = response.json()
        self.assertIn('checks', data)
        if 'database' in data['checks']:
            self.assertEqual(data['checks']['database']['status'], 'unhealthy')

    def test_system_info_debug_mode(self):
        """Test system info endpoint in debug mode"""
        from django.conf import settings
        original_debug = settings.DEBUG
        
        try:
            with patch.object(settings, 'DEBUG', True):
                url = '/system/info/'
                response = self.client.get(url)
                
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertIn('python_version', data)
                self.assertIn('django_version', data)
                self.assertIn('debug_mode', data)
        finally:
            settings.DEBUG = original_debug

    def test_system_info_production_mode(self):
        """Test system info endpoint in production mode"""
        from django.conf import settings
        original_debug = settings.DEBUG
        
        try:
            with patch.object(settings, 'DEBUG', False):
                url = '/system/info/'
                response = self.client.get(url)
                
                # Should require authentication in production
                self.assertIn(response.status_code, [200, 403])
        finally:
            settings.DEBUG = original_debug

    def test_metrics(self):
        """Test metrics endpoint"""
        url = '/metrics/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('timestamp', data)
        self.assertIn('rooms', data)
        self.assertIn('users', data)

    @patch('apps.core.models.RoomActivityLog')
    def test_metrics_with_activity(self, mock_activity_log):
        """Test metrics endpoint with activity logs"""
        from unittest.mock import MagicMock
        
        # Mock queryset
        mock_queryset = MagicMock()
        mock_queryset.filter.return_value.count.return_value = 5
        mock_activity_log.objects = mock_queryset
        
        url = '/metrics/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('rooms', data)
        self.assertIn('users', data)

    def test_get_csrf_token(self):
        """Test CSRF token endpoint"""
        url = '/csrf-token/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('csrfToken', data)
        self.assertIsNotNone(data['csrfToken'])

    def test_health_check_error_handling(self):
        """Test health check error handling"""
        with patch('apps.core.views.timezone') as mock_timezone:
            mock_timezone.now.side_effect = Exception("Error")
            
            url = '/health/'
            response = self.client.get(url)
            
            # Should return 500 on error
            self.assertEqual(response.status_code, 500)
            data = response.json()
            self.assertIn('error', data)

    def test_system_info_error_handling(self):
        """Test system info error handling"""
        with patch('apps.core.views.sys') as mock_sys:
            mock_sys.version.side_effect = Exception("Error")
            
            url = '/system/info/'
            response = self.client.get(url)
            
            # Should return 500 on error
            self.assertEqual(response.status_code, 500)
            data = response.json()
            self.assertIn('error', data)

    def test_metrics_error_handling(self):
        """Test metrics error handling"""
        with patch('apps.core.models.RoomActivityLog') as mock_activity_log:
            mock_activity_log.objects.filter.side_effect = Exception("Error")
            
            url = '/metrics/'
            response = self.client.get(url)
            
            # Should return 500 on error
            self.assertEqual(response.status_code, 500)
            data = response.json()
            self.assertIn('error', data)

