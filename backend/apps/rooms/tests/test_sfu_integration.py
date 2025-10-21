"""
Integration tests for Django + Go SFU server communication
"""
import json
import time
import unittest
from unittest.mock import Mock, patch, MagicMock
import requests
from django.test import TestCase, override_settings
from django.conf import settings
from django.urls import reverse

from ..sfu_client import SFUClient
from ..models import Room, RoomParticipant


class SFUIntegrationTestCase(TestCase):
    """Test cases for Django-SFU integration"""

    def setUp(self):
        """Set up test fixtures"""
        self.sfu_client = SFUClient()
        self.test_room_id = "test-room-123"
        self.test_participant_id = "user-456"

    def tearDown(self):
        """Clean up after tests"""
        # Clean up any created rooms
        try:
            self.sfu_client.delete_room(self.test_room_id)
        except:
            pass

    @patch('requests.request')
    def test_create_room_success(self, mock_request):
        """Test successful room creation through SFU client"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            'success': True,
            'room_id': self.test_room_id,
            'ws_url': 'ws://localhost:8080/ws/test-room-123',
            'created_at': '2023-01-01T00:00:00Z'
        }
        mock_request.return_value = mock_response

        # Call create_room
        response = self.sfu_client.create_room(self.test_room_id)

        # Verify response
        self.assertTrue(response['success'])
        self.assertEqual(response['room_id'], self.test_room_id)
        self.assertIn('ws_url', response)

        # Verify HTTP request was made correctly
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        self.assertEqual(call_args[1]['method'], 'POST')
        self.assertEqual(call_args[1]['json']['room_id'], self.test_room_id)

    @patch('requests.request')
    def test_create_room_failure(self, mock_request):
        """Test room creation failure handling"""
        # Mock failed response
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = requests.HTTPError("Server error")
        mock_request.return_value = mock_response

        # Call create_room
        response = self.sfu_client.create_room(self.test_room_id)

        # Verify error response
        self.assertFalse(response['success'])
        self.assertIn('error', response)

    @patch('requests.request')
    def test_get_room_info(self, mock_request):
        """Test getting room information"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'room_id': self.test_room_id,
            'participant_count': 3,
            'created_at': '2023-01-01T00:00:00Z'
        }
        mock_request.return_value = mock_response

        # Call get_room
        response = self.sfu_client.get_room(self.test_room_id)

        # Verify response
        self.assertTrue(response['success'])
        self.assertEqual(response['room_id'], self.test_room_id)
        self.assertEqual(response['participant_count'], 3)

    @patch('requests.request')
    def test_add_participant(self, mock_request):
        """Test adding participant to room"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'participant_id': self.test_participant_id,
            'status': 'connected'
        }
        mock_request.return_value = mock_response

        # Call add_participant
        metadata = {'name': 'Test User', 'device': 'desktop'}
        response = self.sfu_client.add_participant(
            self.test_room_id,
            self.test_participant_id,
            metadata
        )

        # Verify response
        self.assertTrue(response['success'])
        self.assertEqual(response['participant_id'], self.test_participant_id)

        # Verify metadata was sent
        call_args = mock_request.call_args
        self.assertEqual(call_args[1]['json']['metadata'], metadata)

    @patch('requests.request')
    def test_remove_participant(self, mock_request):
        """Test removing participant from room"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'message': 'Participant removed'
        }
        mock_request.return_value = mock_response

        # Call remove_participant
        response = self.sfu_client.remove_participant(
            self.test_room_id,
            self.test_participant_id
        )

        # Verify response
        self.assertTrue(response['success'])

    @patch('requests.request')
    def test_get_room_stats(self, mock_request):
        """Test getting room statistics"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'room_id': self.test_room_id,
            'participant_count': 5,
            'total_bandwidth': 1024000,
            'avg_latency': 45,
            'packet_loss': 0.5
        }
        mock_request.return_value = mock_response

        # Call get_room_stats
        response = self.sfu_client.get_room_stats(self.test_room_id)

        # Verify response
        self.assertTrue(response['success'])
        self.assertEqual(response['participant_count'], 5)
        self.assertIn('total_bandwidth', response)

    @patch('requests.request')
    def test_health_check(self, mock_request):
        """Test SFU health check"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'status': 'healthy',
            'uptime': '1h30m',
            'version': '1.0.0'
        }
        mock_request.return_value = mock_response

        # Call health_check
        response = self.sfu_client.health_check()

        # Verify response
        self.assertTrue(response['success'])
        self.assertEqual(response['status'], 'healthy')

    @patch('requests.request')
    def test_timeout_handling(self, mock_request):
        """Test timeout handling in SFU requests"""
        # Mock timeout exception
        mock_request.side_effect = requests.exceptions.Timeout("Request timed out")

        # Call create_room
        response = self.sfu_client.create_room(self.test_room_id)

        # Verify timeout error response
        self.assertFalse(response['success'])
        self.assertIn('timeout', response['error'].lower())

    @patch('requests.request')
    def test_connection_error_handling(self, mock_request):
        """Test connection error handling"""
        # Mock connection error
        mock_request.side_effect = requests.exceptions.ConnectionError("Connection refused")

        # Call create_room
        response = self.sfu_client.create_room(self.test_room_id)

        # Verify connection error response
        self.assertFalse(response['success'])
        self.assertIn('unavailable', response['error'].lower())

    @patch('requests.request')
    def test_retry_logic(self, mock_request):
        """Test retry logic for transient failures"""
        # Mock responses: first two fail, third succeeds
        mock_response_fail = Mock()
        mock_response_fail.status_code = 500
        mock_response_fail.raise_for_status.side_effect = requests.HTTPError("Server error")

        mock_response_success = Mock()
        mock_response_success.status_code = 201
        mock_response_success.json.return_value = {
            'success': True,
            'room_id': self.test_room_id
        }

        mock_request.side_effect = [
            mock_response_fail,
            mock_response_fail,
            mock_response_success
        ]

        # Call create_room
        response = self.sfu_client.create_room(self.test_room_id)

        # Verify success after retries
        self.assertTrue(response['success'])

        # Verify retry attempts
        self.assertEqual(3, mock_request.call_count)

    @patch('requests.request')
    def test_invalid_json_response(self, mock_request):
        """Test handling of invalid JSON responses"""
        # Mock response with invalid JSON
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
        mock_request.return_value = mock_response

        # Call create_room
        response = self.sfu_client.create_room(self.test_room_id)

        # Verify error response
        self.assertFalse(response['success'])
        self.assertIn('Invalid response format', response['error'])


class FullIntegrationTestCase(TestCase):
    """Full integration tests with actual SFU server"""

    def setUp(self):
        """Set up for full integration tests"""
        # Skip if SFU server is not available
        try:
            response = requests.get('http://localhost:8080/health', timeout=5)
            self.sfu_available = response.status_code == 200
        except:
            self.sfu_available = False

        if self.sfu_available:
            self.sfu_client = SFUClient()
            self.test_room_id = f"integration-test-{int(time.time())}"

    @unittest.skipIf(not hasattr(settings, 'SFU_API_BASE_URL') or
                     settings.SFU_API_BASE_URL == 'http://localhost:8080/api')
    def test_full_room_lifecycle_integration(self):
        """Test complete room lifecycle with real SFU server"""
        if not self.sfu_available:
            self.skipTest("SFU server not available")

        # Step 1: Create room
        room_response = self.sfu_client.create_room(self.test_room_id)
        self.assertTrue(room_response['success'])

        # Step 2: Add participants
        participant_ids = [f"user-{i}" for i in range(3)]
        for participant_id in participant_ids:
            response = self.sfu_client.add_participant(
                self.test_room_id,
                participant_id,
                {'name': f'User {participant_id}'}
            )
            self.assertTrue(response['success'])

        # Step 3: Get room stats
        stats_response = self.sfu_client.get_room_stats(self.test_room_id)
        self.assertTrue(stats_response['success'])
        self.assertEqual(stats_response['participant_count'], 3)

        # Step 4: Remove participants
        for participant_id in participant_ids[:2]:  # Remove first 2
            response = self.sfu_client.remove_participant(
                self.test_room_id,
                participant_id
            )
            self.assertTrue(response['success'])

        # Step 5: Verify updated stats
        stats_response = self.sfu_client.get_room_stats(self.test_room_id)
        self.assertTrue(stats_response['success'])
        self.assertEqual(stats_response['participant_count'], 1)

        # Step 6: Clean up - delete room
        delete_response = self.sfu_client.delete_room(self.test_room_id)
        self.assertTrue(delete_response['success'])

    @unittest.skipIf(not hasattr(settings, 'SFU_API_BASE_URL') or
                     settings.SFU_API_BASE_URL == 'http://localhost:8080/api')
    def test_health_check_integration(self):
        """Test health check with real SFU server"""
        if not self.sfu_available:
            self.skipTest("SFU server not available")

        response = self.sfu_client.health_check()
        self.assertTrue(response['success'])
        self.assertEqual(response['status'], 'healthy')

    @unittest.skipIf(not hasattr(settings, 'SFU_API_BASE_URL') or
                     settings.SFU_API_BASE_URL == 'http://localhost:8080/api')
    def test_server_stats_integration(self):
        """Test server stats with real SFU server"""
        if not self.sfu_available:
            self.skipTest("SFU server not available")

        response = self.sfu_client.get_server_stats()
        self.assertTrue(response['success'])
        self.assertIn('total_rooms', response)
        self.assertIn('total_participants', response)


class DjangoModelIntegrationTestCase(TestCase):
    """Test Django model integration with SFU operations"""

    def setUp(self):
        """Set up Django model test fixtures"""
        self.test_room = Room.objects.create(
            code="TEST123",
            name="Test Room",
            max_participants=10
        )

    def test_room_creation_with_sfu_integration(self):
        """Test Django room creation triggers SFU room creation"""
        # This would test the actual integration between Django models
        # and SFU room creation (when implemented)

        # For now, we test the model structure
        self.assertEqual(self.test_room.code, "TEST123")
        self.assertEqual(self.test_room.name, "Test Room")
        self.assertEqual(self.test_room.max_participants, 10)
        self.assertEqual(self.test_room.status, "active")

    def test_participant_management_integration(self):
        """Test participant management with SFU synchronization"""
        # Create participants
        participants = []
        for i in range(3):
            participant = RoomParticipant.objects.create(
                room=self.test_room,
                user_id=f"user-{i}",
                status="active"
            )
            participants.append(participant)

        # Verify participants were created
        self.assertEqual(self.test_room.participants.count(), 3)

        # Test participant status updates
        participants[0].status = "disconnected"
        participants[0].save()

        # Verify status update
        participants[0].refresh_from_db()
        self.assertEqual(participants[0].status, "disconnected")

    def test_room_capacity_management(self):
        """Test room capacity limits and SFU integration"""
        # Test max participants limit
        self.assertEqual(self.test_room.max_participants, 10)

        # This would test the integration with SFU capacity management
        # when participants are added/removed