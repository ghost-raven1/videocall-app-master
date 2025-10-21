"""
Rooms app tests - Testing room management, WebSocket functionality, and SFU integration.
"""
import pytest
import json
import uuid
import time
from unittest.mock import patch, MagicMock, AsyncMock
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from faker import Faker
from django.utils import timezone
from datetime import timedelta
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async

User = get_user_model()
fake = Faker()


@pytest.mark.unit
class RoomManagerTestCase(TestCase):
    """Test RoomManager functionality."""

    def setUp(self):
        """Set up test data."""
        # Mock Redis cache
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()
        self.mock_cache.get.return_value = None
        self.mock_cache.set.return_value = True
        self.mock_cache.delete.return_value = True

        # Mock RoomActivityLog
        self.log_patcher = patch('apps.rooms.models.RoomActivityLog')
        self.mock_log = self.log_patcher.start()
        self.mock_log.objects.create.return_value = MagicMock()

    def tearDown(self):
        """Clean up patches."""
        self.cache_patcher.stop()
        self.log_patcher.stop()

    def test_generate_short_code(self):
        """Test short code generation."""
        from apps.rooms.models import RoomManager

        # Mock existing codes to test uniqueness
        self.mock_cache.get.side_effect = lambda key: {
            'room_code_TEST123': 'existing-room-id',
            'room_code_TEST456': 'another-room-id'
        }.get(key)

        with patch('apps.rooms.models.settings', SHORT_CODE_LENGTH=6):
            code = RoomManager.generate_short_code()

            self.assertEqual(len(code), 6)
            self.assertTrue(code.isalnum())
            self.assertTrue(code.isupper())

    def test_create_room(self):
        """Test room creation."""
        from apps.rooms.models import RoomManager

        with patch('apps.rooms.models.settings') as mock_settings:
            mock_settings.ROOM_EXPIRY_HOURS = 24
            mock_settings.MAX_PARTICIPANTS_PER_ROOM = 15

            room_data = RoomManager.create_room(creator_ip='127.0.0.1')

            self.assertIn('room_id', room_data)
            self.assertIn('short_code', room_data)
            self.assertIn('participants', room_data)
            self.assertIn('is_active', room_data)
            self.assertIn('expires_at', room_data)
            self.assertIn('creator_ip', room_data)
            self.assertEqual(room_data['creator_ip'], '127.0.0.1')
            self.assertTrue(room_data['is_active'])
            self.assertEqual(len(room_data['participants']), 0)

    def test_get_room_by_id(self):
        """Test getting room by ID."""
        from apps.rooms.models import RoomManager

        room_data = {'room_id': 'test-room-123', 'is_active': True}
        self.mock_cache.get.return_value = room_data

        result = RoomManager.get_room_by_id('test-room-123')

        self.assertEqual(result, room_data)
        self.mock_cache.get.assert_called_with('room_test-room-123')

    def test_get_room_by_code(self):
        """Test getting room by short code."""
        from apps.rooms.models import RoomManager

        # Mock code to room ID mapping
        self.mock_cache.get.side_effect = lambda key: {
            'room_code_TEST123': 'test-room-123'
        }.get(key, None)

        room_data = {'room_id': 'test-room-123', 'is_active': True}
        self.mock_cache.get.return_value = room_data

        result = RoomManager.get_room_by_code('TEST123')

        self.assertEqual(result, room_data)
        # Should call get twice: once for code lookup, once for room data
        self.assertEqual(self.mock_cache.get.call_count, 2)

    def test_join_room_by_id(self):
        """Test joining room by room ID."""
        from apps.rooms.models import RoomManager

        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
            'participants': [],
            'max_participants': 15
        }
        self.mock_cache.get.return_value = room_data

        with patch('apps.rooms.models.settings', ROOM_EXPIRY_HOURS=24):
            result, message = RoomManager.join_room(
                'test-room-123',
                'participant-123',
                '127.0.0.1'
            )

            self.assertIsNotNone(result)
            self.assertEqual(message, "Successfully joined room")
            self.assertIn('participant-123', result['participants'])
            self.assertEqual(len(result['participants']), 1)

    def test_join_room_by_code(self):
        """Test joining room by short code."""
        from apps.rooms.models import RoomManager

        # Mock code to room ID mapping
        self.mock_cache.get.side_effect = lambda key: {
            'room_code_TEST123': 'test-room-123'
        }.get(key, None)

        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
            'participants': [],
            'max_participants': 15
        }
        self.mock_cache.get.return_value = room_data

        with patch('apps.rooms.models.settings', ROOM_EXPIRY_HOURS=24):
            result, message = RoomManager.join_room(
                'TEST123',
                'participant-456',
                '127.0.0.1'
            )

            self.assertIsNotNone(result)
            self.assertEqual(message, "Successfully joined room")
            self.assertIn('participant-456', result['participants'])

    def test_join_nonexistent_room(self):
        """Test joining non-existent room."""
        from apps.rooms.models import RoomManager

        self.mock_cache.get.return_value = None

        result, message = RoomManager.join_room(
            'nonexistent-room',
            'participant-123',
            '127.0.0.1'
        )

        self.assertIsNone(result)
        self.assertEqual(message, "Room not found")

    def test_join_inactive_room(self):
        """Test joining inactive room."""
        from apps.rooms.models import RoomManager

        room_data = {
            'room_id': 'test-room-123',
            'is_active': False,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat()
        }
        self.mock_cache.get.return_value = room_data

        result, message = RoomManager.join_room(
            'test-room-123',
            'participant-123',
            '127.0.0.1'
        )

        self.assertIsNone(result)
        self.assertEqual(message, "Room is not active")

    def test_join_expired_room(self):
        """Test joining expired room."""
        from apps.rooms.models import RoomManager

        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() - timedelta(hours=1)).isoformat()  # Expired
        }
        self.mock_cache.get.return_value = room_data

        result, message = RoomManager.join_room(
            'test-room-123',
            'participant-123',
            '127.0.0.1'
        )

        self.assertIsNone(result)
        self.assertEqual(message, "Room has expired")

    def test_join_full_room(self):
        """Test joining full room."""
        from apps.rooms.models import RoomManager

        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
            'participants': ['participant-1', 'participant-2'],  # Already 2 participants
            'max_participants': 2  # Set limit to 2
        }
        self.mock_cache.get.return_value = room_data

        result, message = RoomManager.join_room(
            'test-room-123',
            'participant-3',
            '127.0.0.1'
        )

        self.assertIsNone(result)
        self.assertEqual(message, "Room is full")

    def test_leave_room(self):
        """Test leaving room."""
        from apps.rooms.models import RoomManager

        room_data = {
            'room_id': 'test-room-123',
            'participants': ['participant-1', 'participant-2']
        }
        self.mock_cache.get.return_value = room_data

        with patch('apps.rooms.models.settings', ROOM_EXPIRY_HOURS=24):
            result = RoomManager.leave_room('test-room-123', 'participant-1')

            self.assertTrue(result)
            self.assertNotIn('participant-1', room_data['participants'])
            self.assertEqual(len(room_data['participants']), 1)

    def test_leave_room_empty(self):
        """Test leaving room when it's the last participant."""
        from apps.rooms.models import RoomManager

        room_data = {
            'room_id': 'test-room-123',
            'participants': ['participant-1']
        }
        self.mock_cache.get.return_value = room_data

        with patch('apps.rooms.models.settings', ROOM_EXPIRY_HOURS=24):
            result = RoomManager.leave_room('test-room-123', 'participant-1')

            self.assertTrue(result)
            self.mock_cache.delete.assert_called()  # Should delete empty room

    def test_delete_room(self):
        """Test room deletion."""
        from apps.rooms.models import RoomManager

        room_data = {
            'room_id': 'test-room-123',
            'short_code': 'TEST123',
            'sfu_room_id': 'sfu-123'
        }
        self.mock_cache.get.return_value = room_data

        # Mock SFU cleanup
        with patch.object(RoomManager, 'cleanup_sfu_room') as mock_cleanup:
            mock_cleanup.return_value = {'success': True}

            result = RoomManager.delete_room('test-room-123')

            self.assertTrue(result)
            self.mock_cache.delete.assert_called()  # Should delete room data and code mapping
            mock_cleanup.assert_called_once_with('test-room-123')

    def test_check_sfu_threshold(self):
        """Test SFU threshold checking."""
        from apps.rooms.models import RoomManager

        # Mock settings
        with patch('apps.rooms.models.settings') as mock_settings:
            mock_settings.ROOM_SETTINGS = {'sfu_required_threshold': 3}

            room_data = {
                'room_id': 'test-room-123',
                'participants': ['p1', 'p2', 'p3'],  # Exactly at threshold
                'sfu_enabled': False,
                'participant_threshold_reached': False
            }
            self.mock_cache.get.return_value = room_data

            result = RoomManager.check_sfu_threshold('test-room-123')

            self.assertTrue(result)
            self.assertTrue(room_data['participant_threshold_reached'])

    def test_get_room_sfu_info(self):
        """Test getting SFU information for room."""
        from apps.rooms.models import RoomManager

        room_data = {
            'sfu_enabled': True,
            'sfu_room_id': 'sfu-123',
            'sfu_url': 'ws://localhost:8080',
            'room_mode': 'sfu'
        }
        self.mock_cache.get.return_value = room_data

        result = RoomManager.get_room_sfu_info('test-room-123')

        self.assertIsNotNone(result)
        self.assertTrue(result['sfu_enabled'])
        self.assertEqual(result['sfu_room_id'], 'sfu-123')
        self.assertEqual(result['room_mode'], 'sfu')


@pytest.mark.integration
class RoomIntegrationTestCase(TestCase):
    """Integration tests for room functionality."""

    def setUp(self):
        """Set up integration test data."""
        # Mock Redis cache
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()

        # Mock activity logging
        self.log_patcher = patch('apps.rooms.models.RoomActivityLog')
        self.mock_log = self.log_patcher.start()
        self.mock_log.objects.create.return_value = MagicMock()

    def tearDown(self):
        """Clean up patches."""
        self.cache_patcher.stop()
        self.log_patcher.stop()

    def test_full_room_lifecycle(self):
        """Test complete room lifecycle."""
        from apps.rooms.models import RoomManager

        # 1. Create room
        room_data = RoomManager.create_room('127.0.0.1')

        self.assertIsNotNone(room_data)
        self.assertTrue(room_data['is_active'])
        self.assertEqual(len(room_data['participants']), 0)

        # 2. Join participants
        result1, msg1 = RoomManager.join_room(
            room_data['room_id'],
            'participant-1',
            '192.168.1.1'
        )
        self.assertEqual(msg1, "Successfully joined room")
        self.assertEqual(len(result1['participants']), 1)

        result2, msg2 = RoomManager.join_room(
            room_data['room_id'],
            'participant-2',
            '192.168.1.2'
        )
        self.assertEqual(msg2, "Successfully joined room")
        self.assertEqual(len(result2['participants']), 2)

        # 3. Leave participant
        success = RoomManager.leave_room(room_data['room_id'], 'participant-1')
        self.assertTrue(success)

        # 4. Delete room
        with patch.object(RoomManager, 'cleanup_sfu_room') as mock_cleanup:
            mock_cleanup.return_value = {'success': True}
            deleted = RoomManager.delete_room(room_data['room_id'])
            self.assertTrue(deleted)

    def test_sfu_threshold_integration(self):
        """Test SFU threshold integration."""
        from apps.rooms.models import RoomManager

        with patch('apps.rooms.models.settings') as mock_settings:
            mock_settings.ROOM_SETTINGS = {'sfu_required_threshold': 2}

            # Create room
            room_data = RoomManager.create_room()

            # Add participants until threshold
            for i in range(2):
                result, message = RoomManager.join_room(
                    room_data['room_id'],
                    f'participant-{i+1}',
                    f'192.168.1.{i+1}'
                )
                self.assertEqual(message, "Successfully joined room")

            # Check if SFU threshold was reached
            threshold_reached = RoomManager.check_sfu_threshold(room_data['room_id'])
            self.assertTrue(threshold_reached)

    def test_room_expiry_integration(self):
        """Test room expiry functionality."""
        from apps.rooms.models import RoomManager

        # Create room with very short expiry
        room_data = RoomManager.create_room()
        room_data['expires_at'] = (timezone.now() - timedelta(hours=1)).isoformat()
        self.mock_cache.get.return_value = room_data

        # Try to join expired room
        result, message = RoomManager.join_room(
            room_data['room_id'],
            'participant-1',
            '127.0.0.1'
        )

        self.assertIsNone(result)
        self.assertEqual(message, "Room has expired")


@pytest.mark.websocket
class WebSocketTestCase(TestCase):
    """Test WebSocket functionality."""

    @pytest.mark.asyncio
    async def test_websocket_room_join(self):
        """Test WebSocket room joining."""
        from videocall_app.asgi import application
        from channels.testing import WebsocketCommunicator

        communicator = WebsocketCommunicator(application, "/ws/room/test-room/")

        # Connect
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Send join message
        await communicator.send_json_to({
            'type': 'join_room',
            'room_id': 'test-room-123',
            'participant_id': 'participant-123'
        })

        # Receive response
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'room_joined')

        # Cleanup
        await communicator.disconnect()

    @pytest.mark.asyncio
    async def test_websocket_peer_connection(self):
        """Test WebSocket peer connection signaling."""
        from videocall_app.asgi import application

        # Create two communicators (two participants)
        comm1 = WebsocketCommunicator(application, "/ws/room/test-room/")
        comm2 = WebsocketCommunicator(application, "/ws/room/test-room/")

        # Connect both
        await comm1.connect()
        await comm2.connect()

        # Participant 1 sends offer
        await comm1.send_json_to({
            'type': 'webrtc_offer',
            'from': 'participant-1',
            'to': 'participant-2',
            'offer': {'type': 'offer', 'sdp': 'test-sdp'}
        })

        # Participant 2 should receive offer
        response = await comm2.receive_json_from()
        self.assertEqual(response['type'], 'webrtc_offer')
        self.assertEqual(response['from'], 'participant-1')

        # Cleanup
        await comm1.disconnect()
        await comm2.disconnect()


@pytest.mark.api
class RoomAPITestCase(APITestCase):
    """Test room API endpoints."""

    def setUp(self):
        """Set up API test data."""
        self.user = User.objects.create_user(
            email='apiuser@test.com',
            password='apipass123',
            role='user'
        )

        self.client.force_authenticate(user=self.user)

    def test_create_room_api(self):
        """Test room creation API."""
        url = reverse('create_room')
        data = {'room_name': 'Test Room'}

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('room_id', response.data)
        self.assertIn('short_code', response.data)

    def test_join_room_api(self):
        """Test room joining API."""
        # First create a room
        create_url = reverse('create_room')
        create_response = self.client.post(create_url, {'room_name': 'Test Room'})
        room_id = create_response.data['room_id']

        # Join the room
        join_url = reverse('join_room', kwargs={'room_id': room_id})
        join_response = self.client.post(join_url)

        self.assertEqual(join_response.status_code, status.HTTP_200_OK)
        self.assertTrue(join_response.data['success'])

    def test_room_info_api(self):
        """Test room information API."""
        # Create a room first
        create_url = reverse('create_room')
        create_response = self.client.post(create_url, {'room_name': 'Test Room'})
        room_id = create_response.data['room_id']

        # Get room info
        info_url = reverse('room_info', kwargs={'room_id': room_id})
        response = self.client.get(info_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('room_id', response.data)
        self.assertIn('participants', response.data)


@pytest.mark.security
class RoomSecurityTestCase(TestCase):
    """Security tests for room functionality."""

    def setUp(self):
        """Set up security test data."""
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()

        self.log_patcher = patch('apps.rooms.models.RoomActivityLog')
        self.mock_log = self.log_patcher.start()
        self.mock_log.objects.create.return_value = MagicMock()

    def tearDown(self):
        """Clean up patches."""
        self.cache_patcher.stop()
        self.log_patcher.stop()

    def test_room_id_validation(self):
        """Test room ID validation and security."""
        from apps.rooms.models import RoomManager

        # Test with various potentially malicious room IDs
        malicious_ids = [
            '../../../etc/passwd',
            '<script>alert("xss")</script>',
            'javascript:alert(1)',
            'room_id; DROP TABLE rooms;',
            'room_id\' OR \'1\'=\'1'
        ]

        for malicious_id in malicious_ids:
            # Should handle gracefully without errors
            result = RoomManager.get_room_by_id(malicious_id)
            # Result should be None for non-existent rooms
            self.assertIsNone(result)

    def test_short_code_security(self):
        """Test short code generation security."""
        from apps.rooms.models import RoomManager

        # Test that short codes are properly randomized
        codes = set()
        for _ in range(100):
            code = RoomManager.generate_short_code(4)  # Short for testing
            self.assertEqual(len(code), 4)
            self.assertTrue(code.isalnum())
            codes.add(code)

        # Should have good variety (not all the same)
        self.assertGreater(len(codes), 50)  # At least 50 unique codes out of 100

    def test_rate_limiting_simulation(self):
        """Test rate limiting for room operations."""
        from apps.rooms.models import RoomManager

        # Simulate rapid room creation
        for i in range(10):
            room_data = RoomManager.create_room(f'127.0.0.{i+1}')

            # Each room should have unique short code
            self.assertIsNotNone(room_data['short_code'])

        # All rooms should be created successfully
        self.assertEqual(self.mock_cache.set.call_count, 20)  # 10 rooms + 10 code mappings

    def test_ip_logging_security(self):
        """Test that IP addresses are properly logged."""
        from apps.rooms.models import RoomManager

        # Create room with specific IP
        room_data = RoomManager.create_room('192.168.1.100')

        # Should log room creation with IP
        self.mock_log.objects.create.assert_called()
        call_args = self.mock_log.objects.create.call_args

        self.assertEqual(call_args[1]['ip_address'], '192.168.1.100')
        self.assertEqual(call_args[1]['action'], 'created')


@pytest.mark.performance
class RoomPerformanceTestCase(TestCase):
    """Performance tests for room functionality."""

    def setUp(self):
        """Set up performance test data."""
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()

        self.log_patcher = patch('apps.rooms.models.RoomActivityLog')
        self.mock_log = self.log_patcher.start()
        self.mock_log.objects.create.return_value = MagicMock()

    def tearDown(self):
        """Clean up patches."""
        self.cache_patcher.stop()
        self.log_patcher.stop()

    def test_bulk_room_operations_performance(self):
        """Test performance of bulk room operations."""
        from apps.rooms.models import RoomManager

        num_rooms = 100
        start_time = time.time()

        # Create many rooms
        for i in range(num_rooms):
            room_data = RoomManager.create_room(f'127.0.0.{i+1}')
            self.assertIsNotNone(room_data)

        creation_time = time.time() - start_time

        # Should create 100 rooms in reasonable time (< 2 seconds)
        self.assertLess(creation_time, 2.0)

        # Test bulk joining
        start_time = time.time()
        for i in range(num_rooms):
            result, message = RoomManager.join_room(
                f'room-{i}',
                f'participant-{i}',
                f'127.0.0.{i+1}'
            )
            self.assertEqual(message, "Successfully joined room")

        join_time = time.time() - start_time

        # Should join 100 rooms in reasonable time (< 1 second)
        self.assertLess(join_time, 1.0)

    def test_concurrent_room_access_performance(self):
        """Test performance of concurrent room access."""
        from apps.rooms.models import RoomManager

        # Create a room
        room_data = RoomManager.create_room()
        room_data['participants'] = []

        # Simulate concurrent access
        participants = []
        for i in range(10):
            result, message = RoomManager.join_room(
                room_data['room_id'],
                f'participant-{i}',
                f'192.168.1.{i+1}'
            )
            participants.append(f'participant-{i}')

        # All participants should be in room
        self.assertEqual(len(room_data['participants']), 10)
        for participant in participants:
            self.assertIn(participant, room_data['participants'])
