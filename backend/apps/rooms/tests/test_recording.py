"""
Tests for recording functionality
"""
import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta


@pytest.mark.unit
class RecordingTestCase(TestCase):
    """Test recording functionality"""

    def setUp(self):
        """Set up test data"""
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()
        self.mock_cache.get.return_value = None
        self.mock_cache.set.return_value = True

    def tearDown(self):
        """Clean up patches"""
        self.cache_patcher.stop()

    def test_recording_creation(self):
        """Test creating a recording"""
        from apps.rooms.recording_models import Recording
        from apps.rooms.models import RoomManager

        # Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create recording
        recording = Recording.objects.create(
            room_id=room_id,
            created_by_id='participant-123',
            status='recording',
            include_audio=True,
            include_video=True,
            include_screen_share=False
        )

        self.assertIsNotNone(recording.id)
        self.assertEqual(recording.status, 'recording')
        self.assertTrue(recording.include_audio)
        self.assertTrue(recording.include_video)
        self.assertFalse(recording.include_screen_share)

    def test_recording_stop(self):
        """Test stopping a recording"""
        from apps.rooms.recording_models import Recording
        from apps.rooms.models import RoomManager

        # Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create recording
        recording = Recording.objects.create(
            room_id=room_id,
            created_by_id='participant-123',
            status='recording'
        )

        # Stop recording
        recording.stop()

        self.assertEqual(recording.status, 'completed')
        self.assertIsNotNone(recording.ended_at)

    def test_recording_duration_calculation(self):
        """Test recording duration calculation"""
        from apps.rooms.recording_models import Recording
        from apps.rooms.models import RoomManager

        # Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create recording with start time
        start_time = timezone.now()
        recording = Recording.objects.create(
            room_id=room_id,
            created_by_id='participant-123',
            status='recording',
            started_at=start_time
        )

        # Stop after 30 seconds
        end_time = start_time + timedelta(seconds=30)
        recording.ended_at = end_time
        recording.status = 'completed'
        recording.save()

        # Calculate duration
        duration = recording.duration_seconds
        self.assertEqual(duration, 30)

    def test_recording_to_dict(self):
        """Test recording serialization to dict"""
        from apps.rooms.recording_models import Recording
        from apps.rooms.models import RoomManager

        # Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_id = room_data['room_id']

        # Create recording
        recording = Recording.objects.create(
            room_id=room_id,
            created_by_id='participant-123',
            status='recording'
        )

        # Convert to dict
        recording_dict = recording.to_dict()

        self.assertIn('id', recording_dict)
        self.assertIn('room_id', recording_dict)
        self.assertIn('status', recording_dict)
        self.assertEqual(recording_dict['status'], 'recording')


@pytest.mark.api
class RecordingAPITestCase(APITestCase):
    """Test recording API endpoints"""

    def setUp(self):
        """Set up API test data"""
        from apps.rooms.models import RoomManager

        # Create room
        self.room_data = RoomManager.create_room('127.0.0.1')
        self.room_id = self.room_data['room_id']

    def test_start_recording(self):
        """Test starting a recording via API"""
        url = '/api/rooms/recordings/start/'
        data = {
            'room_id': self.room_id,
            'participant_id': 'participant-123',
            'include_audio': True,
            'include_video': True
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get('success', False))
        self.assertIn('recording', response.data)

    def test_stop_recording(self):
        """Test stopping a recording via API"""
        from apps.rooms.recording_models import Recording

        # Create recording first
        recording = Recording.objects.create(
            room_id=self.room_id,
            created_by_id='participant-123',
            status='recording'
        )

        url = f'/api/rooms/recordings/{recording.id}/stop/'
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('success', False))
        recording.refresh_from_db()
        self.assertEqual(recording.status, 'completed')

    def test_get_recordings_list(self):
        """Test getting list of recordings"""
        from apps.rooms.recording_models import Recording

        # Create some recordings
        for i in range(3):
            Recording.objects.create(
                room_id=self.room_id,
                created_by_id=f'participant-{i}',
                status='completed'
            )

        url = f'/api/rooms/recordings/?room_id={self.room_id}'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 3)

    def test_prevent_multiple_recordings(self):
        """Test preventing multiple simultaneous recordings"""
        from apps.rooms.recording_models import Recording

        # Create active recording
        Recording.objects.create(
            room_id=self.room_id,
            created_by_id='participant-1',
            status='recording'
        )

        # Try to start another recording
        url = '/api/rooms/recordings/start/'
        data = {
            'room_id': self.room_id,
            'participant_id': 'participant-2'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already in progress', response.data.get('error', ''))

