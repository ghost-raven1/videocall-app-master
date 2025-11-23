"""
Tests for logger functionality and SFU/P2P mode switching
"""
import pytest
import logging
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from apps.rooms.models import RoomManager


@pytest.mark.unit
class LoggerTestCase(TestCase):
    """Test logger functionality in models.py"""

    def setUp(self):
        """Set up test data."""
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()
        self.mock_cache.get.return_value = None
        self.mock_cache.set.return_value = True
        self.mock_cache.delete.return_value = True

        self.log_patcher = patch('apps.rooms.models.RoomActivityLog')
        self.mock_log = self.log_patcher.start()
        self.mock_log.objects.create.return_value = MagicMock()

    def tearDown(self):
        """Clean up patches."""
        self.cache_patcher.stop()
        self.log_patcher.stop()

    def test_logger_imported(self):
        """Test that logger is properly imported and initialized."""
        from apps.rooms.models import logger
        
        self.assertIsNotNone(logger)
        self.assertIsInstance(logger, logging.Logger)
        self.assertEqual(logger.name, 'apps.rooms.models')

    def test_logger_used_in_create_sfu_room(self):
        """Test that logger is used in create_sfu_room method."""
        from apps.rooms.models import logger
        
        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
            'participants': [],
            'max_participants': 15,
            'sfu_enabled': False,
            'room_mode': 'p2p'
        }
        self.mock_cache.get.return_value = room_data

        # Mock SFU client
        with patch('apps.rooms.models.SFUClient') as mock_sfu_client_class:
            mock_sfu_client = MagicMock()
            mock_sfu_client_class.return_value = mock_sfu_client
            
            # Mock health check failure
            mock_sfu_client.health_check.return_value = {'success': False}
            
            # Capture logger calls
            with patch.object(logger, 'warning') as mock_warning:
                result = RoomManager.create_sfu_room('test-room-123')
                
                # Verify logger was called
                self.assertTrue(mock_warning.called)
                self.assertIn('SFU server unavailable', str(mock_warning.call_args))

    def test_logger_used_in_delete_room(self):
        """Test that logger is used in delete_room method."""
        from apps.rooms.models import logger
        
        room_data = {
            'room_id': 'test-room-123',
            'short_code': 'TEST123',
            'sfu_room_id': None
        }
        self.mock_cache.get.return_value = room_data

        # Mock SFU cleanup
        with patch.object(RoomManager, 'cleanup_sfu_room') as mock_cleanup:
            mock_cleanup.return_value = {'success': True}
            
            # Capture logger calls
            with patch.object(logger, 'info') as mock_info:
                result = RoomManager.delete_room('test-room-123')
                
                # Verify logger was called
                self.assertTrue(mock_info.called)
                self.assertIn('Room deleted successfully', str(mock_info.call_args))


@pytest.mark.unit
class SFUModeTestCase(TestCase):
    """Test SFU mode creation and fallback"""

    def setUp(self):
        """Set up test data."""
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()
        self.mock_cache.get.return_value = None
        self.mock_cache.set.return_value = True
        self.mock_cache.delete.return_value = True

        self.log_patcher = patch('apps.rooms.models.RoomActivityLog')
        self.mock_log = self.log_patcher.start()
        self.mock_log.objects.create.return_value = MagicMock()

    def tearDown(self):
        """Clean up patches."""
        self.cache_patcher.stop()
        self.log_patcher.stop()

    def test_create_sfu_room_success(self):
        """Test successful SFU room creation."""
        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
            'participants': [],
            'max_participants': 15,
            'sfu_enabled': False,
            'room_mode': 'p2p'
        }
        self.mock_cache.get.return_value = room_data

        # Mock SFU client
        with patch('apps.rooms.models.SFUClient') as mock_sfu_client_class:
            mock_sfu_client = MagicMock()
            mock_sfu_client_class.return_value = mock_sfu_client
            
            # Mock successful health check and room creation
            mock_sfu_client.health_check.return_value = {'success': True}
            mock_sfu_client.create_room.return_value = {
                'success': True,
                'room_id': 'sfu-room-123',
                'ws_url': 'ws://localhost:8080/ws?room=sfu-room-123&peer=test-peer'
            }
            
            result = RoomManager.create_sfu_room('test-room-123')
            
            self.assertTrue(result['success'])
            self.assertEqual(result['sfu_room_id'], 'sfu-room-123')
            self.assertEqual(result['mode'], 'sfu')
            
            # Verify room data was updated
            self.mock_cache.set.assert_called()
            call_args = self.mock_cache.set.call_args
            updated_room_data = call_args[0][1]
            self.assertTrue(updated_room_data['sfu_enabled'])
            self.assertEqual(updated_room_data['room_mode'], 'sfu')

    def test_create_sfu_room_health_check_failure(self):
        """Test SFU room creation with health check failure."""
        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
            'participants': [],
            'max_participants': 15,
            'sfu_enabled': False,
            'room_mode': 'p2p'
        }
        self.mock_cache.get.return_value = room_data

        # Mock SFU client
        with patch('apps.rooms.models.SFUClient') as mock_sfu_client_class:
            mock_sfu_client = MagicMock()
            mock_sfu_client_class.return_value = mock_sfu_client
            
            # Mock health check failure
            mock_sfu_client.health_check.return_value = {'success': False}
            
            result = RoomManager.create_sfu_room('test-room-123')
            
            # Should fallback to P2P mode
            self.assertTrue(result['success'])
            self.assertEqual(result['mode'], 'p2p_fallback')
            self.assertIn('reason', result)

    def test_create_sfu_room_creation_failure(self):
        """Test SFU room creation with room creation failure."""
        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
            'participants': [],
            'max_participants': 15,
            'sfu_enabled': False,
            'room_mode': 'p2p'
        }
        self.mock_cache.get.return_value = room_data

        # Mock SFU client
        with patch('apps.rooms.models.SFUClient') as mock_sfu_client_class:
            mock_sfu_client = MagicMock()
            mock_sfu_client_class.return_value = mock_sfu_client
            
            # Mock successful health check but failed room creation
            mock_sfu_client.health_check.return_value = {'success': True}
            mock_sfu_client.create_room.return_value = {
                'success': False,
                'error': 'Room creation failed'
            }
            
            result = RoomManager.create_sfu_room('test-room-123')
            
            # Should fallback to P2P mode
            self.assertTrue(result['success'])
            self.assertEqual(result['mode'], 'p2p_fallback')

    def test_fallback_to_p2p_mode(self):
        """Test fallback to P2P mode."""
        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
            'participants': [],
            'max_participants': 15,
            'sfu_enabled': False,
            'room_mode': 'p2p'
        }
        self.mock_cache.get.return_value = room_data

        result = RoomManager._fallback_to_p2p_mode('test-room-123', 'Test reason')
        
        self.assertTrue(result['success'])
        self.assertEqual(result['mode'], 'p2p_fallback')
        self.assertEqual(result['reason'], 'Test reason')
        
        # Verify room data was updated
        self.mock_cache.set.assert_called()
        call_args = self.mock_cache.set.call_args
        updated_room_data = call_args[0][1]
        self.assertFalse(updated_room_data['sfu_enabled'])
        self.assertEqual(updated_room_data['room_mode'], 'p2p_fallback')

    def test_cleanup_sfu_room(self):
        """Test SFU room cleanup."""
        room_data = {
            'room_id': 'test-room-123',
            'sfu_room_id': 'sfu-room-123'
        }
        self.mock_cache.get.return_value = room_data

        # Mock SFU client
        with patch('apps.rooms.models.SFUClient') as mock_sfu_client_class:
            mock_sfu_client = MagicMock()
            mock_sfu_client_class.return_value = mock_sfu_client
            
            # Mock successful deletion
            mock_sfu_client.delete_room.return_value = {'success': True}
            
            result = RoomManager.cleanup_sfu_room('test-room-123')
            
            self.assertTrue(result['success'])
            mock_sfu_client.delete_room.assert_called_once_with('sfu-room-123')

    def test_cleanup_sfu_room_no_sfu_room(self):
        """Test SFU room cleanup when no SFU room exists."""
        room_data = {
            'room_id': 'test-room-123',
            'sfu_room_id': None
        }
        self.mock_cache.get.return_value = room_data

        result = RoomManager.cleanup_sfu_room('test-room-123')
        
        self.assertTrue(result['success'])
        self.assertIn('No SFU room to cleanup', result['message'])

    def test_join_room_triggers_sfu_creation(self):
        """Test that joining room triggers SFU creation when threshold is reached."""
        room_data = {
            'room_id': 'test-room-123',
            'is_active': True,
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
            'participants': ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],  # 7 participants
            'max_participants': 15,
            'sfu_enabled': False,
            'room_mode': 'p2p'
        }
        self.mock_cache.get.return_value = room_data

        # Mock settings
        with patch('apps.rooms.models.settings') as mock_settings:
            mock_settings.SFU_THRESHOLD = 8
            mock_settings.ROOM_EXPIRY_HOURS = 24
            
            # Mock SFU client
            with patch('apps.rooms.models.SFUClient') as mock_sfu_client_class:
                mock_sfu_client = MagicMock()
                mock_sfu_client_class.return_value = mock_sfu_client
                
                # Mock successful SFU creation
                mock_sfu_client.health_check.return_value = {'success': True}
                mock_sfu_client.create_room.return_value = {
                    'success': True,
                    'room_id': 'sfu-room-123',
                    'ws_url': 'ws://localhost:8080/ws?room=sfu-room-123'
                }
                
                result, message = RoomManager.join_room(
                    'test-room-123',
                    'participant-8',  # 8th participant - should trigger SFU
                    '127.0.0.1'
                )
                
                self.assertIsNotNone(result)
                self.assertEqual(message, "Successfully joined room")
                # Verify SFU was created
                mock_sfu_client.create_room.assert_called_once()


@pytest.mark.integration
class SFUIntegrationTestCase(TestCase):
    """Integration tests for SFU functionality"""

    def setUp(self):
        """Set up test data."""
        self.cache_patcher = patch('apps.rooms.models.cache')
        self.mock_cache = self.cache_patcher.start()
        self.mock_cache.get.return_value = None
        self.mock_cache.set.return_value = True
        self.mock_cache.delete.return_value = True

        self.log_patcher = patch('apps.rooms.models.RoomActivityLog')
        self.mock_log = self.log_patcher.start()
        self.mock_log.objects.create.return_value = MagicMock()

    def tearDown(self):
        """Clean up patches."""
        self.cache_patcher.stop()
        self.log_patcher.stop()

    def test_full_sfu_lifecycle(self):
        """Test complete SFU room lifecycle."""
        # 1. Create room
        room_data = RoomManager.create_room('127.0.0.1')
        room_data['participants'] = []
        self.mock_cache.get.return_value = room_data

        # 2. Add participants until SFU threshold
        with patch('apps.rooms.models.settings') as mock_settings:
            mock_settings.SFU_THRESHOLD = 3
            mock_settings.ROOM_EXPIRY_HOURS = 24
            
            # Mock SFU client
            with patch('apps.rooms.models.SFUClient') as mock_sfu_client_class:
                mock_sfu_client = MagicMock()
                mock_sfu_client_class.return_value = mock_sfu_client
                
                mock_sfu_client.health_check.return_value = {'success': True}
                mock_sfu_client.create_room.return_value = {
                    'success': True,
                    'room_id': 'sfu-room-123',
                    'ws_url': 'ws://localhost:8080/ws?room=sfu-room-123'
                }
                
                # Add 3 participants (threshold)
                for i in range(3):
                    result, message = RoomManager.join_room(
                        room_data['room_id'],
                        f'participant-{i+1}',
                        f'127.0.0.{i+1}'
                    )
                    self.assertEqual(message, "Successfully joined room")
                
                # Verify SFU was created
                self.assertTrue(mock_sfu_client.create_room.called)
                
                # 3. Cleanup SFU room
                room_data['sfu_room_id'] = 'sfu-room-123'
                self.mock_cache.get.return_value = room_data
                
                mock_sfu_client.delete_room.return_value = {'success': True}
                cleanup_result = RoomManager.cleanup_sfu_room(room_data['room_id'])
                self.assertTrue(cleanup_result['success'])

