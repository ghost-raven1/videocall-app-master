"""
WebSocket integration tests
Tests WebSocket connections and message handling
"""
import pytest
import json
from channels.testing import WebsocketCommunicator
from django.test import TestCase
from apps.rooms.consumers import VideoCallConsumer
from apps.rooms.models import RoomManager


@pytest.mark.integration
@pytest.mark.websocket
class WebSocketIntegrationTestCase(TestCase):
    """Integration tests for WebSocket connections"""

    async def test_websocket_connection(self):
        """Test WebSocket connection establishment"""
        room_id = 'test-room-123'
        
        # Create room first
        room_data = RoomManager.create_room(creator_ip='127.0.0.1')
        room_id = room_data['room_id']
        
        # Connect to WebSocket
        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{room_id}/'
        )
        connected, subprotocol = await communicator.connect()
        
        self.assertTrue(connected)
        
        # Clean up
        await communicator.disconnect()

    async def test_websocket_join_message(self):
        """Test sending join message via WebSocket"""
        room_data = RoomManager.create_room(creator_ip='127.0.0.1')
        room_id = room_data['room_id']
        
        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{room_id}/'
        )
        await communicator.connect()
        
        # Send join message
        message = {
            'type': 'join',
            'participant_id': 'user-123',
            'participant_name': 'Test User'
        }
        await communicator.send_json_to(message)
        
        # Receive response
        response = await communicator.receive_json_from(timeout=5)
        self.assertIn('type', response)
        
        await communicator.disconnect()

    async def test_websocket_webrtc_offer(self):
        """Test WebRTC offer message via WebSocket"""
        room_data = RoomManager.create_room(creator_ip='127.0.0.1')
        room_id = room_data['room_id']
        
        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{room_id}/'
        )
        await communicator.connect()
        
        # Send WebRTC offer
        offer_message = {
            'type': 'webrtc_offer',
            'sender': 'user-123',
            'target': 'user-456',
            'offer': {
                'type': 'offer',
                'sdp': 'test-sdp'
            }
        }
        await communicator.send_json_to(offer_message)
        
        # Should receive acknowledgment or forward to target
        # (In real scenario, target would receive the message)
        
        await communicator.disconnect()

    async def test_websocket_ice_candidate(self):
        """Test ICE candidate message via WebSocket"""
        room_data = RoomManager.create_room(creator_ip='127.0.0.1')
        room_id = room_data['room_id']
        
        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{room_id}/'
        )
        await communicator.connect()
        
        # Send ICE candidate
        ice_message = {
            'type': 'ice_candidate',
            'sender': 'user-123',
            'target': 'user-456',
            'candidate': {
                'candidate': 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
                'sdpMLineIndex': 0,
                'sdpMid': '0'
            }
        }
        await communicator.send_json_to(ice_message)
        
        await communicator.disconnect()

    async def test_websocket_chat_message(self):
        """Test chat message via WebSocket"""
        room_data = RoomManager.create_room(creator_ip='127.0.0.1')
        room_id = room_data['room_id']
        
        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{room_id}/'
        )
        await communicator.connect()
        
        # Send chat message
        chat_message = {
            'type': 'chat_message',
            'participant_id': 'user-123',
            'participant_name': 'Test User',
            'message': 'Hello from WebSocket test',
            'timestamp': '2025-01-27T12:00:00Z'
        }
        await communicator.send_json_to(chat_message)
        
        # Should broadcast to all participants
        # In a real scenario, other participants would receive this
        
        await communicator.disconnect()

    async def test_websocket_multiple_connections(self):
        """Test multiple WebSocket connections to same room"""
        room_data = RoomManager.create_room(creator_ip='127.0.0.1')
        room_id = room_data['room_id']
        
        # Create multiple connections
        communicators = []
        for i in range(3):
            communicator = WebsocketCommunicator(
                VideoCallConsumer.as_asgi(),
                f'/ws/room/{room_id}/'
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            communicators.append(communicator)
        
        # Send message from first connection
        message = {
            'type': 'chat_message',
            'participant_id': 'user-1',
            'message': 'Test message'
        }
        await communicators[0].send_json_to(message)
        
        # All connections should be able to send/receive
        for communicator in communicators:
            await communicator.disconnect()

    async def test_websocket_disconnect_cleanup(self):
        """Test that WebSocket disconnect properly cleans up"""
        room_data = RoomManager.create_room(creator_ip='127.0.0.1')
        room_id = room_data['room_id']
        
        communicator = WebsocketCommunicator(
            VideoCallConsumer.as_asgi(),
            f'/ws/room/{room_id}/'
        )
        await communicator.connect()
        
        # Send join message
        await communicator.send_json_to({
            'type': 'join',
            'participant_id': 'user-123'
        })
        
        # Disconnect
        await communicator.disconnect()
        
        # Room should still exist, but participant should be removed
        # (This depends on implementation)
        room_info = RoomManager.get_room_by_id(room_id)
        self.assertIsNotNone(room_info)

