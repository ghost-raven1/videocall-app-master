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

