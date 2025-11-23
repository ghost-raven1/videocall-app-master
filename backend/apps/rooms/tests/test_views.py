"""
Tests for rooms views - create_room, join_room, RoomManagementViewSet, RoomAnalyticsViewSet
"""
import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from apps.rooms.models import RoomManager

User = get_user_model()


@pytest.mark.api
@pytest.mark.django_db(transaction=True)
class RoomViewsTestCase(APITestCase):
    """Test room creation and management views"""
    
    @pytest.fixture(autouse=True)
    def setup_db(self, transactional_db):
        """Set up test data with database access"""
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='adminpass123',
            role='admin',
            is_staff=True
        )
        yield

    @patch('apps.rooms.models.RoomManager.create_room')
    def test_create_room(self, mock_create_room):
        """Test creating a room"""
        mock_create_room.return_value = {
            'room_id': 'test-room-123',
            'short_code': 'TEST123',
            'created_at': '2025-01-27T00:00:00Z',
            'expires_at': '2025-01-28T00:00:00Z',
            'max_participants': 15,
            'room_mode': 'p2p',
            'sfu_enabled': False
        }
        
        url = '/api/rooms/create/'
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('room_id', response.data)
        self.assertIn('short_code', response.data)
        self.assertIn('qr_code', response.data)

    @patch('apps.rooms.models.RoomManager.join_room')
    def test_join_room(self, mock_join_room):
        """Test joining a room by short code"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_join_room.return_value = (
            {
                'room_id': 'test-room-123',
                'short_code': 'TEST123',
                'is_active': True,
                'participants': ['participant-1'],
                'max_participants': 15,
                'expires_at': future_expires
            },
            'Successfully joined room'
        )
        
        url = '/api/rooms/join/'
        data = {
            'room_identifier': 'TEST123',
            'participant_id': 'participant-1'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('room_id', response.data)

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    def test_get_room(self, mock_get_room):
        """Test getting room information"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': 'test-room-123',
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [],
            'max_participants': 15,
            'expires_at': future_expires
        }
        
        url = '/api/rooms/test-room-123/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['room_id'], 'test-room-123')


@pytest.mark.api
@pytest.mark.django_db(transaction=True)
class RoomManagementViewSetTestCase(APITestCase):
    """Test RoomManagementViewSet API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_db(self, transactional_db):
        """Set up test data with database access"""
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='adminpass123',
            role='admin',
            is_staff=True
        )
        yield
    def test_active_rooms_endpoint(self):
        """Test getting active rooms"""
        self.client.force_authenticate(user=self.admin)
        url = '/api/rooms/admin/rooms/active/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('active_rooms', response.data)
        self.assertIn('total_count', response.data)
    def test_room_activity_logs_endpoint(self):
        """Test getting room activity logs"""
        self.client.force_authenticate(user=self.admin)
        url = '/api/rooms/admin/activity/logs/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, (list, dict))


@pytest.mark.api
@pytest.mark.django_db(transaction=True)
class RoomAnalyticsViewSetTestCase(APITestCase):
    """Test RoomAnalyticsViewSet API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_db(self, transactional_db):
        """Set up test data with database access"""
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='adminpass123',
            role='admin',
            is_staff=True
        )
        yield
    def test_dashboard_stats_endpoint(self):
        """Test getting dashboard statistics"""
        self.client.force_authenticate(user=self.admin)
        url = '/api/rooms/admin/analytics/dashboard/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('activeRooms', response.data)
        self.assertIn('onlineUsers', response.data)
        self.assertIn('totalCalls', response.data)
    def test_dashboard_stats_alias(self):
        """Test dashboard stats alias endpoint"""
        self.client.force_authenticate(user=self.admin)
        url = '/api/rooms/admin/dashboard/stats'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('activeRooms', response.data)


@pytest.mark.api
@pytest.mark.django_db(transaction=True)
class RoomViewsExtendedTestCase(APITestCase):
    """Extended tests for room views covering edge cases and error handling"""
    
    @pytest.fixture(autouse=True)
    def setup_db(self, transactional_db):
        """Set up test data with database access"""
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='adminpass123',
            role='admin',
            is_staff=True
        )
        yield

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    def test_get_room_not_found(self, mock_get_room):
        """Test getting non-existent room"""
        mock_get_room.return_value = None
        
        url = '/api/rooms/non-existent-room/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', response.data)

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    def test_get_room_expired(self, mock_get_room):
        """Test getting expired room"""
        from django.utils import timezone
        from datetime import timedelta
        
        past_expires = (timezone.now() - timedelta(hours=1)).isoformat()
        mock_get_room.return_value = {
            'room_id': 'expired-room',
            'short_code': 'EXP123',
            'is_active': True,
            'participants': [],
            'expires_at': past_expires
        }
        
        url = '/api/rooms/expired-room/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', response.data)

    @patch('apps.rooms.models.RoomManager.join_room')
    def test_join_room_missing_identifier(self, mock_join_room):
        """Test joining room without identifier"""
        url = '/api/rooms/join/'
        response = self.client.post(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    @patch('apps.rooms.models.RoomManager.leave_room')
    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    def test_leave_room(self, mock_get_room, mock_leave_room):
        """Test leaving a room"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': 'test-room-123',
            'short_code': 'TEST123',
            'is_active': True,
            'participants': ['participant-1'],
            'expires_at': future_expires
        }
        mock_leave_room.return_value = True
        
        # Ensure session exists
        self.client.session.create()
        participant_id = self.client.session.session_key
        
        url = '/api/rooms/test-room-123/leave/'
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('success', response.data)

    @patch('apps.rooms.models.RoomManager.delete_room')
    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    def test_delete_room(self, mock_get_room, mock_delete_room):
        """Test deleting a room"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': 'test-room-123',
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [],
            'expires_at': future_expires
        }
        mock_delete_room.return_value = True
        
        url = '/api/rooms/test-room-123/delete/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('success', response.data)

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    def test_delete_room_not_found(self, mock_get_room):
        """Test deleting non-existent room"""
        mock_get_room.return_value = None
        
        url = '/api/rooms/non-existent-room/delete/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch('apps.rooms.models.RoomManager.create_sfu_room')
    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    def test_create_sfu_room(self, mock_get_room, mock_create_sfu):
        """Test creating SFU room"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': 'test-room-123',
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [],
            'expires_at': future_expires
        }
        mock_create_sfu.return_value = {
            'success': True,
            'sfu_room_id': 'sfu-room-123',
            'sfu_ws_url': 'ws://sfu.example.com/ws',
            'mode': 'sfu'
        }
        
        url = '/api/rooms/test-room-123/sfu/create/'
        response = self.client.post(url, {'room_id': 'test-room-123'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('sfu_room_id', response.data)

    @patch('apps.rooms.models.RoomManager.get_room_sfu_info')
    def test_get_room_sfu_info(self, mock_get_sfu_info):
        """Test getting SFU room info"""
        mock_get_sfu_info.return_value = {
            'sfu_enabled': True,
            'sfu_room_id': 'sfu-room-123',
            'sfu_ws_url': 'ws://sfu.example.com/ws',
            'room_mode': 'sfu'
        }
        
        url = '/api/rooms/test-room-123/sfu/info/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('sfu_enabled', response.data)

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    def test_get_room_statistics(self, mock_get_room):
        """Test getting room statistics"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': 'test-room-123',
            'short_code': 'TEST123',
            'is_active': True,
            'participants': ['participant-1', 'participant-2'],
            'expires_at': future_expires,
            'created_at': (timezone.now() - timedelta(hours=1)).isoformat()
        }
        
        url = '/api/rooms/test-room-123/statistics/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('room_id', response.data)

    @patch('apps.rooms.sfu_client.SFUClient')
    def test_get_sfu_server_stats(self, mock_sfu_client_class):
        """Test getting SFU server statistics"""
        mock_sfu_client = mock_sfu_client_class.return_value
        mock_sfu_client.get_server_stats.return_value = {
            'success': True,
            'active_rooms': 5,
            'total_participants': 12
        }
        mock_sfu_client.health_check.return_value = {
            'success': True
        }
        
        url = '/api/rooms/sfu/server/stats/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('sfu_server', response.data)

    @patch('apps.rooms.models.RoomManager.monitor_room_health')
    def test_check_room_health(self, mock_monitor_health):
        """Test checking room health"""
        mock_monitor_health.return_value = {
            'success': True,
            'health': {
                'room_id': 'test-room-123',
                'status': 'healthy',
                'participants': 2,
                'sfu_health': {
                    'healthy': True
                }
            }
        }
        
        url = '/api/rooms/test-room-123/health/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('room_id', response.data)

    def test_health_check(self):
        """Test API health check endpoint"""
        url = '/api/rooms/health/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('status', response.data)

    @patch('apps.rooms.models.RoomManager.create_room')
    def test_create_room_error_handling(self, mock_create_room):
        """Test error handling in create_room"""
        mock_create_room.side_effect = Exception("Database error")
        
        url = '/api/rooms/create/'
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn('error', response.data)

    @patch('apps.rooms.models.RoomManager.join_room')
    def test_join_room_error_handling(self, mock_join_room):
        """Test error handling in join_room"""
        mock_join_room.side_effect = Exception("Database error")
        
        url = '/api/rooms/join/'
        response = self.client.post(url, {'room_identifier': 'TEST123'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn('error', response.data)

