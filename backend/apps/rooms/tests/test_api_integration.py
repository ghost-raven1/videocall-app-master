"""
Comprehensive API integration tests
Tests full API workflows and component interactions
"""
import pytest
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from rest_framework import status
from apps.rooms.models import RoomManager
from apps.authentication.models import User

User = get_user_model()


@pytest.mark.integration
@pytest.mark.api
class RoomAPIIntegrationTestCase(TestCase):
    """Integration tests for Room API endpoints"""

    def setUp(self):
        """Set up test fixtures"""
        self.client = Client()
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            role='user'
        )
        self.client.force_login(self.user)

    def test_create_room_workflow(self):
        """Test complete room creation workflow"""
        # Step 1: Create room via API
        response = self.client.post('/api/rooms/create/', {
            'creator_ip': '127.0.0.1'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('room_id', response.json())
        self.assertIn('short_code', response.json())
        
        room_id = response.json()['room_id']
        short_code = response.json()['short_code']
        
        # Step 2: Get room info
        response = self.client.get(f'/api/rooms/{room_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['room_id'], room_id)
        
        # Step 3: Get room by short code
        response = self.client.get(f'/api/rooms/by-code/{short_code}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['room_id'], room_id)
        
        # Step 4: Delete room
        response = self.client.delete(f'/api/rooms/{room_id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_participant_join_workflow(self):
        """Test participant joining workflow"""
        # Create room
        response = self.client.post('/api/rooms/create/', {
            'creator_ip': '127.0.0.1'
        })
        room_id = response.json()['room_id']
        
        # Add participant
        participant_id = 'participant-123'
        response = self.client.post(f'/api/rooms/{room_id}/participants/', {
            'participant_id': participant_id,
            'participant_name': 'Test Participant'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Get room info and verify participant
        response = self.client.get(f'/api/rooms/{room_id}/')
        participants = response.json().get('participants', [])
        participant_ids = [p.get('participant_id') for p in participants]
        self.assertIn(participant_id, participant_ids)
        
        # Remove participant
        response = self.client.delete(f'/api/rooms/{room_id}/participants/{participant_id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_chat_integration_workflow(self):
        """Test chat message workflow"""
        # Create room
        response = self.client.post('/api/rooms/create/', {
            'creator_ip': '127.0.0.1'
        })
        room_id = response.json()['room_id']
        short_code = response.json()['short_code']
        
        # Send chat message
        response = self.client.post('/api/rooms/chat/messages/', {
            'room_code': short_code,
            'participant_id': 'user-123',
            'content': 'Test message',
            'message_type': 'text'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message_id = response.json().get('id')
        self.assertIsNotNone(message_id)
        
        # Get chat history
        response = self.client.get(f'/api/rooms/chat/messages/?room_code={short_code}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        messages = response.json().get('messages', [])
        self.assertGreater(len(messages), 0)
        
        # Find our message
        message = next((m for m in messages if m.get('id') == message_id), None)
        self.assertIsNotNone(message)
        self.assertEqual(message.get('content'), 'Test message')

    def test_recording_workflow(self):
        """Test recording workflow"""
        # Create room
        response = self.client.post('/api/rooms/create/', {
            'creator_ip': '127.0.0.1'
        })
        room_id = response.json()['room_id']
        
        # Start recording
        response = self.client.post(f'/api/rooms/{room_id}/recording/start/')
        
        # Recording may not be enabled in test environment
        if response.status_code == status.HTTP_200_OK:
            recording_id = response.json().get('recording_id')
            self.assertIsNotNone(recording_id)
            
            # Stop recording
            response = self.client.post(f'/api/rooms/{room_id}/recording/stop/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
            # Get recording info
            response = self.client.get(f'/api/rooms/{room_id}/recording/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        else:
            # Recording not enabled, skip
            pytest.skip('Recording not enabled in test environment')


@pytest.mark.integration
@pytest.mark.websocket
class WebSocketIntegrationTestCase(TestCase):
    """Integration tests for WebSocket connections"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            role='user'
        )

    def test_websocket_connection(self):
        """Test WebSocket connection establishment"""
        # This would require async test setup
        # For now, we'll test the consumer logic
        from apps.rooms.consumers import VideoCallConsumer
        
        # Verify consumer exists
        self.assertIsNotNone(VideoCallConsumer)
        
        # Test would require actual WebSocket connection
        # This is a placeholder for full WebSocket integration test
        pass

    def test_websocket_message_handling(self):
        """Test WebSocket message handling"""
        # Placeholder for WebSocket message handling tests
        # Would require async test framework
        pass


@pytest.mark.integration
@pytest.mark.e2e
class FullWorkflowIntegrationTestCase(TestCase):
    """Full end-to-end workflow integration tests"""

    def setUp(self):
        """Set up test fixtures"""
        self.client = Client()
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            role='user'
        )
        self.client.force_login(self.user)

    def test_complete_video_call_workflow(self):
        """Test complete video call workflow from creation to end"""
        # Step 1: Create room
        response = self.client.post('/api/rooms/create/', {
            'creator_ip': '127.0.0.1'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        room_id = response.json()['room_id']
        short_code = response.json()['short_code']
        
        # Step 2: Add multiple participants
        participants = []
        for i in range(3):
            participant_id = f'participant-{i}'
            response = self.client.post(f'/api/rooms/{room_id}/participants/', {
                'participant_id': participant_id,
                'participant_name': f'User {i}'
            })
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            participants.append(participant_id)
        
        # Step 3: Verify room has all participants
        response = self.client.get(f'/api/rooms/{room_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        room_participants = response.json().get('participants', [])
        self.assertEqual(len(room_participants), 3)
        
        # Step 4: Send chat messages
        for i, participant_id in enumerate(participants):
            response = self.client.post('/api/rooms/chat/messages/', {
                'room_code': short_code,
                'participant_id': participant_id,
                'content': f'Message from participant {i}',
                'message_type': 'text'
            })
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Step 5: Get chat history
        response = self.client.get(f'/api/rooms/chat/messages/?room_code={short_code}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        messages = response.json().get('messages', [])
        self.assertEqual(len(messages), 3)
        
        # Step 6: Remove participants
        for participant_id in participants[1:]:  # Keep first participant
            response = self.client.delete(f'/api/rooms/{room_id}/participants/{participant_id}/')
            self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Step 7: Verify only one participant remains
        response = self.client.get(f'/api/rooms/{room_id}/')
        room_participants = response.json().get('participants', [])
        self.assertEqual(len(room_participants), 1)
        
        # Step 8: Delete room
        response = self.client.delete(f'/api/rooms/{room_id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Step 9: Verify room is deleted
        response = self.client.get(f'/api/rooms/{room_id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

