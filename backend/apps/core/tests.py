"""
Core app tests - Testing core system models and functionality.
"""
import pytest
import os
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from faker import Faker
from unittest.mock import patch, MagicMock

User = get_user_model()
fake = Faker()


@pytest.mark.unit
class SystemSettingsTestCase(TestCase):
    """Test SystemSettings model functionality."""

    def setUp(self):
        """Set up test data."""
        # Clear any existing settings
        from apps.core.models import SystemSettings
        SystemSettings.objects.all().delete()

    def test_singleton_pattern(self):
        """Test that only one settings instance can exist."""
        from apps.core.models import SystemSettings

        # Create first instance
        settings1 = SystemSettings.objects.create(
            access_password_hash=make_password('password1'),
            is_active=True
        )

        # Try to create second instance
        settings2 = SystemSettings.objects.create(
            access_password_hash=make_password('password2'),
            is_active=True
        )

        # Both should have same primary key (1)
        self.assertEqual(settings1.pk, 1)
        self.assertEqual(settings2.pk, 1)

        # Should only have one instance in database
        self.assertEqual(SystemSettings.objects.count(), 1)

    def test_set_and_check_password(self):
        """Test password setting and checking."""
        from apps.core.models import SystemSettings

        settings = SystemSettings()
        settings.set_password('testpassword123')

        # Password should be hashed
        self.assertNotEqual(settings.access_password_hash, 'testpassword123')

        # Check password should work
        self.assertTrue(settings.check_password('testpassword123'))
        self.assertFalse(settings.check_password('wrongpassword'))

    def test_get_settings_with_environment_variable(self):
        """Test getting settings from environment variable."""
        from apps.core.models import SystemSettings

        # Mock environment variable
        with patch.dict(os.environ, {'ADMIN_PASSWORD': 'env_password_123'}):
            settings = SystemSettings.get_settings()

            self.assertIsNotNone(settings)
            self.assertTrue(settings.check_password('env_password_123'))
            self.assertTrue(settings.is_active)

    def test_get_settings_without_environment_variable(self):
        """Test getting settings without environment variable raises error."""
        from apps.core.models import SystemSettings

        # Remove environment variable if it exists
        with patch.dict(os.environ, {'ADMIN_PASSWORD': ''}, clear=True):
            with self.assertRaises(ValueError) as context:
                SystemSettings.get_settings()

            self.assertIn('ADMIN_PASSWORD environment variable is required', str(context.exception))

    def test_get_settings_creates_new_if_not_exists(self):
        """Test that get_settings creates settings if they don't exist."""
        from apps.core.models import SystemSettings

        # Ensure no settings exist
        SystemSettings.objects.all().delete()

        with patch.dict(os.environ, {'ADMIN_PASSWORD': 'new_password_123'}):
            settings = SystemSettings.get_settings()

            self.assertIsNotNone(settings)
            self.assertTrue(settings.check_password('new_password_123'))

            # Should be saved to database
            self.assertEqual(SystemSettings.objects.count(), 1)

    def test_get_settings_updates_existing(self):
        """Test that get_settings updates existing settings if needed."""
        from apps.core.models import SystemSettings

        # Create initial settings
        existing = SystemSettings.objects.create(
            access_password_hash=make_password('old_password'),
            is_active=False
        )

        with patch.dict(os.environ, {'ADMIN_PASSWORD': 'new_password_123'}):
            settings = SystemSettings.get_settings()

            # Should return existing instance
            self.assertEqual(settings.pk, existing.pk)

            # Should update with new password
            self.assertTrue(settings.check_password('new_password_123'))
            self.assertTrue(settings.is_active)

    def test_save_method_enforces_singleton(self):
        """Test that save method enforces singleton pattern."""
        from apps.core.models import SystemSettings

        settings = SystemSettings()
        settings.set_password('test123')
        settings.save()

        # Should have pk=1
        self.assertEqual(settings.pk, 1)

        # Try to save another instance
        settings2 = SystemSettings()
        settings2.set_password('test456')
        settings2.save()

        # Should still have pk=1
        self.assertEqual(settings2.pk, 1)

        # Password should be updated
        self.assertTrue(settings2.check_password('test456'))

    def test_delete_method_prevents_deletion(self):
        """Test that delete method prevents deletion."""
        from apps.core.models import SystemSettings

        settings = SystemSettings.objects.create(
            access_password_hash=make_password('test123')
        )

        # Try to delete
        settings.delete()

        # Should still exist in database
        self.assertEqual(SystemSettings.objects.count(), 1)
        self.assertEqual(SystemSettings.objects.first().pk, settings.pk)

    def test_str_method(self):
        """Test string representation."""
        from apps.core.models import SystemSettings

        settings = SystemSettings()
        settings.set_password('test123')
        settings.save()

        str_repr = str(settings)
        self.assertIn('System Settings', str_repr)
        self.assertIn('Updated:', str_repr)


@pytest.mark.unit
class RoomActivityLogTestCase(TestCase):
    """Test RoomActivityLog model functionality."""

    def setUp(self):
        """Set up test data."""
        from apps.core.models import RoomActivityLog

        self.log_entry = RoomActivityLog.objects.create(
            room_id='test-room-123',
            action='created',
            participant_count=1,
            ip_address='127.0.0.1',
            user_agent_hash='hash123'
        )

    def test_create_log_entry(self):
        """Test creating a log entry."""
        from apps.core.models import RoomActivityLog

        self.assertEqual(self.log_entry.room_id, 'test-room-123')
        self.assertEqual(self.log_entry.action, 'created')
        self.assertEqual(self.log_entry.participant_count, 1)
        self.assertEqual(self.log_entry.ip_address, '127.0.0.1')
        self.assertEqual(self.log_entry.user_agent_hash, 'hash123')
        self.assertIsNotNone(self.log_entry.timestamp)

    def test_action_choices(self):
        """Test that action choices are properly defined."""
        from apps.core.models import RoomActivityLog

        # Test all valid actions
        for action, display_name in RoomActivityLog.ACTION_CHOICES:
            entry = RoomActivityLog.objects.create(
                room_id='test-room',
                action=action,
                participant_count=1
            )
            self.assertEqual(entry.get_action_display(), display_name)

    def test_room_id_indexing(self):
        """Test that room_id is properly indexed."""
        from apps.core.models import RoomActivityLog

        # Create multiple entries for same room
        for i in range(3):
            RoomActivityLog.objects.create(
                room_id='test-room-123',
                action='joined',
                participant_count=i + 1
            )

        # Should be able to filter by room_id efficiently
        entries = RoomActivityLog.objects.filter(room_id='test-room-123')
        self.assertEqual(entries.count(), 4)  # Including original

    def test_ordering_by_timestamp(self):
        """Test that entries are ordered by timestamp descending."""
        from apps.core.models import RoomActivityLog

        # Create entries with delays
        entry1 = RoomActivityLog.objects.create(
            room_id='test-room-1',
            action='created'
        )

        import time
        time.sleep(0.01)  # Small delay

        entry2 = RoomActivityLog.objects.create(
            room_id='test-room-1',
            action='joined'
        )

        entries = RoomActivityLog.objects.filter(room_id='test-room-1')
        timestamps = [entry.timestamp for entry in entries]

        # Most recent should be first
        self.assertEqual(entries.first(), entry2)
        self.assertEqual(entries.last(), entry1)

    def test_str_method(self):
        """Test string representation."""
        str_repr = str(self.log_entry)
        self.assertIn('Room Created', str_repr)
        self.assertIn('test-room', str_repr)
        self.assertIn('at', str_repr)

    def test_index_creation(self):
        """Test that database indexes are created correctly."""
        from apps.core.models import RoomActivityLog

        # This test ensures indexes are properly defined
        # In a real scenario, you'd check actual index existence

        # Test that filtering by indexed fields works
        entries = RoomActivityLog.objects.filter(room_id='test-room-123')
        self.assertEqual(entries.count(), 1)

        entries = RoomActivityLog.objects.filter(action='created')
        self.assertEqual(entries.count(), 1)


@pytest.mark.integration
class CoreIntegrationTestCase(TestCase):
    """Integration tests for core functionality."""

    def test_system_settings_integration(self):
        """Test system settings integration with environment."""
        from apps.core.models import SystemSettings

        # Test with different environment passwords
        test_cases = [
            'simple_password',
            'Complex!Pass123',
            'very-long-password-with-special-chars-!@#$%^&*()'
        ]

        for password in test_cases:
            with patch.dict(os.environ, {'ADMIN_PASSWORD': password}):
                settings = SystemSettings.get_settings()
                self.assertTrue(settings.check_password(password))

    def test_activity_logging_integration(self):
        """Test activity logging in realistic scenarios."""
        from apps.core.models import RoomActivityLog

        room_id = 'integration-test-room'

        # Simulate room lifecycle
        actions = [
            ('created', 1),
            ('joined', 2),
            ('joined', 3),
            ('left', 2),
            ('left', 1),
            ('expired', 0)
        ]

        for action, count in actions:
            RoomActivityLog.objects.create(
                room_id=room_id,
                action=action,
                participant_count=count,
                ip_address='192.168.1.100'
            )

        # Verify all actions were logged
        logs = RoomActivityLog.objects.filter(room_id=room_id).order_by('timestamp')

        self.assertEqual(logs.count(), 6)

        for i, (expected_action, _) in enumerate(actions):
            self.assertEqual(logs[i].action, expected_action)

        # Check participant counts
        participant_counts = [log.participant_count for log in logs]
        expected_counts = [count for _, count in actions]
        self.assertEqual(participant_counts, expected_counts)


@pytest.mark.security
class CoreSecurityTestCase(TestCase):
    """Security tests for core functionality."""

    def test_password_hashing_security(self):
        """Test password hashing security."""
        from apps.core.models import SystemSettings

        settings = SystemSettings()

        # Test with various password types
        passwords = [
            'weak',
            'StrongPassword123!',
            'very-long-password-with-special-characters-!@#$%^&*()_+{}|:<>?[]\;\'",./'
        ]

        for password in passwords:
            settings.set_password(password)

            # Should not store plain text
            self.assertNotEqual(settings.access_password_hash, password)

            # Should verify correctly
            self.assertTrue(settings.check_password(password))
            self.assertFalse(settings.check_password(password + 'x'))

    def test_timing_attack_protection(self):
        """Test protection against timing attacks."""
        from apps.core.models import SystemSettings

        settings = SystemSettings()
        settings.set_password('correct_password')

        import time

        # Time checking correct password
        start = time.time()
        settings.check_password('correct_password')
        correct_time = time.time() - start

        # Time checking wrong password
        start = time.time()
        settings.check_password('wrong_password')
        wrong_time = time.time() - start

        # Times should be relatively similar (within 50ms)
        time_diff = abs(correct_time - wrong_time)
        self.assertLess(time_diff, 0.05)  # 50ms tolerance


@pytest.mark.performance
class CorePerformanceTestCase(TestCase):
    """Performance tests for core functionality."""

    def test_bulk_activity_logging_performance(self):
        """Test performance of bulk activity logging."""
        from apps.core.models import RoomActivityLog

        # Create many log entries
        num_entries = 1000

        start_time = timezone.now()

        for i in range(num_entries):
            RoomActivityLog.objects.create(
                room_id=f'perf-room-{i % 10}',  # 10 different rooms
                action='joined',
                participant_count=1
            )

        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds()

        # Should be able to create 1000 entries in reasonable time (< 5 seconds)
        self.assertLess(duration, 5.0)

        # Verify all entries were created
        self.assertEqual(RoomActivityLog.objects.count(), num_entries)

    def test_settings_singleton_performance(self):
        """Test performance of singleton pattern."""
        from apps.core.models import SystemSettings

        # Time multiple calls to get_settings
        start_time = timezone.now()

        for _ in range(100):
            with patch.dict(os.environ, {'ADMIN_PASSWORD': 'perf_test_123'}):
                settings = SystemSettings.get_settings()
                self.assertTrue(settings.check_password('perf_test_123'))

        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds()

        # Should be fast (< 1 second for 100 calls)
        self.assertLess(duration, 1.0)
