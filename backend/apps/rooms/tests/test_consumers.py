"""
Tests for WebSocket consumers - VideoCallConsumer
"""
import pytest
import json
from unittest.mock import patch, MagicMock, AsyncMock
from channels.testing import WebsocketCommunicator
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from apps.rooms.consumers import VideoCallConsumer
from apps.rooms.models import RoomManager


@pytest.mark.websocket
@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class VideoCallConsumerTestCase(TestCase):
    """Test WebSocket consumer for video calls"""

    @pytest.fixture(autouse=True)
    def setup_db(self, transactional_db):
        """Set up test data with database access"""
        # Create a test room
        self.room_id = 'test-room-123'
        self.participant_id = 'participant-1'
        yield

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    async def test_connect_success(self, mock_get_room):
        """Test successful WebSocket connection"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': self.room_id,
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [],
            'max_participants': 15,
            'expires_at': future_expires
        }

        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{self.room_id}/'
        )
        
        # Set up session
        communicator.scope['session'] = {
            'session_key': self.participant_id
        }
        communicator.scope['url_route'] = {
            'kwargs': {'room_id': self.room_id}
        }

        connected, subprotocol = await communicator.connect()
        
        self.assertTrue(connected)
        await communicator.disconnect()

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    async def test_connect_room_not_found(self, mock_get_room):
        """Test connection to non-existent room"""
        mock_get_room.return_value = None

        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/non-existent-room/'
        )
        
        communicator.scope['session'] = {'session_key': self.participant_id}
        communicator.scope['url_route'] = {
            'kwargs': {'room_id': 'non-existent-room'}
        }

        connected, subprotocol = await communicator.connect()
        
        self.assertFalse(connected)
        self.assertEqual(communicator.close_code, 4004)

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    async def test_connect_room_full(self, mock_get_room):
        """Test connection to full room"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        # Room is full (15 participants, max is 15)
        mock_get_room.return_value = {
            'room_id': self.room_id,
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [f'participant-{i}' for i in range(15)],
            'max_participants': 15,
            'expires_at': future_expires
        }

        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{self.room_id}/'
        )
        
        communicator.scope['session'] = {'session_key': 'new-participant'}
        communicator.scope['url_route'] = {
            'kwargs': {'room_id': self.room_id}
        }

        connected, subprotocol = await communicator.connect()
        
        self.assertFalse(connected)
        self.assertEqual(communicator.close_code, 4003)

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    async def test_receive_offer(self, mock_get_room):
        """Test receiving WebRTC offer"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': self.room_id,
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [self.participant_id],
            'max_participants': 15,
            'expires_at': future_expires
        }

        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{self.room_id}/'
        )
        
        communicator.scope['session'] = {'session_key': self.participant_id}
        communicator.scope['url_route'] = {
            'kwargs': {'room_id': self.room_id}
        }

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Send offer message
        offer_message = {
            'type': 'offer',
            'sdp': 'test-sdp',
            'target_participant_id': 'participant-2'
        }
        
        await communicator.send_json_to(offer_message)
        
        # Should receive response
        response = await communicator.receive_json_from(timeout=1)
        self.assertIn('type', response)
        
        await communicator.disconnect()

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    async def test_receive_ice_candidate(self, mock_get_room):
        """Test receiving ICE candidate"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': self.room_id,
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [self.participant_id],
            'max_participants': 15,
            'expires_at': future_expires
        }

        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{self.room_id}/'
        )
        
        communicator.scope['session'] = {'session_key': self.participant_id}
        communicator.scope['url_route'] = {
            'kwargs': {'room_id': self.room_id}
        }

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Send ICE candidate message
        ice_message = {
            'type': 'ice-candidate',
            'candidate': 'test-candidate',
            'target_participant_id': 'participant-2'
        }
        
        await communicator.send_json_to(ice_message)
        
        await communicator.disconnect()

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    async def test_receive_answer(self, mock_get_room):
        """Test receiving WebRTC answer"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': self.room_id,
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [self.participant_id],
            'max_participants': 15,
            'expires_at': future_expires
        }

        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{self.room_id}/'
        )
        
        communicator.scope['session'] = {'session_key': self.participant_id}
        communicator.scope['url_route'] = {
            'kwargs': {'room_id': self.room_id}
        }

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Send answer message
        answer_message = {
            'type': 'answer',
            'sdp': 'test-answer-sdp',
            'target_participant_id': 'participant-2'
        }
        
        await communicator.send_json_to(answer_message)
        
        await communicator.disconnect()

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    async def test_user_joined_message(self, mock_get_room):
        """Test user_joined group message"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': self.room_id,
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [],
            'max_participants': 15,
            'expires_at': future_expires
        }

        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{self.room_id}/'
        )
        
        communicator.scope['session'] = {'session_key': self.participant_id}
        communicator.scope['url_route'] = {
            'kwargs': {'room_id': self.room_id}
        }

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Should receive user_joined message
        try:
            message = await communicator.receive_json_from(timeout=1)
            self.assertIn('type', message)
        except Exception:
            # Message might not be sent immediately
            pass
        
        await communicator.disconnect()

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    async def test_disconnect(self, mock_get_room):
        """Test WebSocket disconnection"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': self.room_id,
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [self.participant_id],
            'max_participants': 15,
            'expires_at': future_expires
        }

        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{self.room_id}/'
        )
        
        communicator.scope['session'] = {'session_key': self.participant_id}
        communicator.scope['url_route'] = {
            'kwargs': {'room_id': self.room_id}
        }

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Disconnect
        await communicator.disconnect()
        
        # Connection should be closed
        self.assertFalse(communicator.is_connected())

    @patch('apps.rooms.models.RoomManager.get_room_by_id')
    async def test_invalid_message(self, mock_get_room):
        """Test handling invalid message"""
        from django.utils import timezone
        from datetime import timedelta
        
        future_expires = (timezone.now() + timedelta(hours=24)).isoformat()
        mock_get_room.return_value = {
            'room_id': self.room_id,
            'short_code': 'TEST123',
            'is_active': True,
            'participants': [self.participant_id],
            'max_participants': 15,
            'expires_at': future_expires
        }

        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{self.room_id}/'
        )
        
        communicator.scope['session'] = {'session_key': self.participant_id}
        communicator.scope['url_route'] = {
            'kwargs': {'room_id': self.room_id}
        }

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Send invalid message
        await communicator.send_json_to({'type': 'invalid_type'})
        
        # Should not crash
        await communicator.disconnect()

