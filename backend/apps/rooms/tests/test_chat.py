"""
Tests for chat functionality
"""
import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

User = get_user_model()


@pytest.mark.unit
class ChatMessageTestCase(TestCase):
    """Test chat message functionality"""

    def setUp(self):
        """Set up test data"""
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()
        self.mock_cache.get.return_value = None
        self.mock_cache.set.return_value = True

    def tearDown(self):
        """Clean up patches"""
        self.cache_patcher.stop()

    def test_chat_message_creation(self):
        """Test creating a chat message"""
        from apps.rooms.chat_models import ChatMessage
        from apps.rooms.models import RoomManager

        # Create room first
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create chat message
        message = ChatMessage.objects.create(
            room_id=room_id,
            participant_id='participant-123',
            content='Test message',
            message_type='text'
        )

        self.assertIsNotNone(message.id)
        self.assertEqual(message.content, 'Test message')
        self.assertEqual(message.message_type, 'text')
        self.assertEqual(message.room_id, room_id)

    def test_chat_message_reply(self):
        """Test replying to a chat message"""
        from apps.rooms.chat_models import ChatMessage
        from apps.rooms.models import RoomManager

        # Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create original message
        original = ChatMessage.objects.create(
            room_id=room_id,
            participant_id='participant-1',
            content='Original message',
            message_type='text'
        )

        # Create reply
        reply = ChatMessage.objects.create(
            room_id=room_id,
            participant_id='participant-2',
            content='Reply message',
            message_type='text',
            reply_to=original
        )

        self.assertEqual(reply.reply_to, original)
        self.assertEqual(reply.content, 'Reply message')

    def test_chat_message_edit(self):
        """Test editing a chat message"""
        from apps.rooms.chat_models import ChatMessage
        from apps.rooms.models import RoomManager

        # Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create message
        message = ChatMessage.objects.create(
            room_id=room_id,
            participant_id='participant-123',
            content='Original content',
            message_type='text'
        )

        # Edit message
        message.content = 'Edited content'
        message.is_edited = True
        message.save()

        self.assertEqual(message.content, 'Edited content')
        self.assertTrue(message.is_edited)

    def test_chat_message_deletion(self):
        """Test deleting a chat message"""
        from apps.rooms.chat_models import ChatMessage
        from apps.rooms.models import RoomManager

        # Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create message
        message = ChatMessage.objects.create(
            room_id=room_id,
            participant_id='participant-123',
            content='Message to delete',
            message_type='text'
        )

        # Delete message (soft delete)
        message.is_deleted = True
        message.content = '[Deleted]'
        message.save()

        self.assertTrue(message.is_deleted)
        self.assertEqual(message.content, '[Deleted]')


@pytest.mark.unit
class ChatAttachmentTestCase(TestCase):
    """Test chat attachment functionality"""

    def setUp(self):
        """Set up test data"""
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()
        self.mock_cache.get.return_value = None
        self.mock_cache.set.return_value = True

    def tearDown(self):
        """Clean up patches"""
        self.cache_patcher.stop()

    def test_chat_attachment_creation(self):
        """Test creating a chat attachment"""
        from apps.rooms.chat_models import ChatAttachment
        from apps.rooms.models import RoomManager

        # Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create attachment
        attachment = ChatAttachment.objects.create(
            room_id=room_id,
            participant_id='participant-123',
            file_name='test.pdf',
            file_size=1024,
            file_type='application/pdf'
        )

        self.assertIsNotNone(attachment.id)
        self.assertEqual(attachment.file_name, 'test.pdf')
        self.assertEqual(attachment.file_size, 1024)
        self.assertEqual(attachment.file_type, 'application/pdf')

    def test_chat_attachment_file_size_limit(self):
        """Test file size limit validation"""
        from apps.rooms.chat_models import ChatAttachment
        from apps.rooms.models import RoomManager

        # Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create attachment with size within limit (50MB)
        attachment = ChatAttachment.objects.create(
            room_id=room_id,
            participant_id='participant-123',
            file_name='test.pdf',
            file_size=50 * 1024 * 1024 - 1,  # Just under 50MB
            file_type='application/pdf'
        )

        self.assertIsNotNone(attachment.id)

        # Try to create attachment exceeding limit
        with self.assertRaises(Exception):
            ChatAttachment.objects.create(
                room_id=room_id,
                participant_id='participant-123',
                file_name='large.pdf',
                file_size=51 * 1024 * 1024,  # Over 50MB
                file_type='application/pdf'
            )


@pytest.mark.api
class ChatAPITestCase(APITestCase):
    """Test chat API endpoints"""

    def setUp(self):
        """Set up API test data"""
        from apps.rooms.models import RoomManager

        # Create room
        self.room_data = RoomManager.create_room('127.0.0.1')
        self.room_id = self.room_data['room_id']
        self.room_code = self.room_data['short_code']

    def test_send_chat_message(self):
        """Test sending a chat message via API"""
        url = '/api/rooms/chat/messages/'
        data = {
            'room_code': self.room_code,
            'participant_id': 'participant-123',
            'content': 'Test message',
            'message_type': 'text'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get('success', False))
        self.assertIn('message', response.data)

    def test_get_chat_history(self):
        """Test getting chat message history"""
        from apps.rooms.chat_models import ChatMessage

        # Create some messages
        for i in range(5):
            ChatMessage.objects.create(
                room_id=self.room_id,
                participant_id=f'participant-{i}',
                content=f'Message {i}',
                message_type='text'
            )

        url = f'/api/rooms/chat/messages/history/?room_code={self.room_code}&limit=10'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('success', False))
        self.assertIn('messages', response.data)
        self.assertEqual(len(response.data['messages']), 5)

    def test_upload_chat_attachment(self):
        """Test uploading a chat attachment"""
        from io import BytesIO
        from django.core.files.uploadedfile import SimpleUploadedFile

        # Create test file
        test_file = SimpleUploadedFile(
            "test.pdf",
            b"file content",
            content_type="application/pdf"
        )

        url = '/api/rooms/chat/attachments/'
        data = {
            'room_code': self.room_code,
            'participant_id': 'participant-123',
            'file': test_file
        }

        response = self.client.post(url, data, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get('success', False))
        self.assertIn('attachment', response.data)

    def test_get_chat_attachments(self):
        """Test getting chat attachments list"""
        from apps.rooms.chat_models import ChatAttachment

        # Create some attachments
        for i in range(3):
            ChatAttachment.objects.create(
                room_id=self.room_id,
                participant_id=f'participant-{i}',
                file_name=f'file_{i}.pdf',
                file_size=1024,
                file_type='application/pdf'
            )

        url = f'/api/rooms/chat/attachments/list_by_room/?room_code={self.room_code}'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('success', False))
        self.assertIn('attachments', response.data)
        self.assertEqual(len(response.data['attachments']), 3)

    def test_edit_chat_message(self):
        """Test editing a chat message via API"""
        from apps.rooms.chat_models import ChatMessage

        # Create message
        message = ChatMessage.objects.create(
            room_id=self.room_id,
            participant_id='participant-123',
            content='Original message',
            message_type='text'
        )

        url = f'/api/rooms/chat/messages/{message.id}/'
        data = {
            'content': 'Edited message'
        }

        response = self.client.patch(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('success', False))
        message.refresh_from_db()
        self.assertEqual(message.content, 'Edited message')
        self.assertTrue(message.is_edited)

    def test_delete_chat_message(self):
        """Test deleting a chat message via API"""
        from apps.rooms.chat_models import ChatMessage

        # Create message
        message = ChatMessage.objects.create(
            room_id=self.room_id,
            participant_id='participant-123',
            content='Message to delete',
            message_type='text'
        )

        url = f'/api/rooms/chat/messages/{message.id}/'
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('success', False))
        message.refresh_from_db()
        self.assertTrue(message.is_deleted)

