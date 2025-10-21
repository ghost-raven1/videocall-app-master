"""
Test utilities and factories for Django tests.
Provides reusable components for testing the videocall application.
"""
import factory
import faker
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APITestCase
import uuid

User = get_user_model()
fake = faker.Faker()


class BaseTestCase(TestCase):
    """Enhanced base test case with common utilities."""

    def setUp(self):
        """Set up common test data."""
        super().setUp()
        self.fake = fake

    def create_test_user(self, email=None, role='user', **kwargs):
        """Create a test user with random data."""
        if email is None:
            email = fake.email()

        return User.objects.create_user(
            email=email,
            password=fake.password(),
            role=role,
            first_name=fake.first_name(),
            last_name=fake.last_name(),
            **kwargs
        )

    def create_authenticated_client(self, user=None):
        """Create an authenticated test client."""
        from django.test import Client

        if user is None:
            user = self.create_test_user()

        client = Client()

        # Login user
        response = client.post('/api/auth/token/', {
            'email': user.email,
            'password': 'testpass123'  # Default password for factory users
        })

        if response.status_code == 200:
            # Extract cookies for authenticated requests
            access_cookie = response.cookies.get('access_token')
            refresh_cookie = response.cookies.get('refresh_token')

            if access_cookie and refresh_cookie:
                client.cookies['access_token'] = access_cookie.value
                client.cookies['refresh_token'] = refresh_cookie.value

        return client, user

    def assert_response_status(self, response, expected_status):
        """Assert response has expected status code."""
        self.assertEqual(response.status_code, expected_status)

    def assert_response_contains(self, response, text):
        """Assert response contains specific text."""
        self.assertContains(response, text)


class BaseAPITestCase(APITestCase):
    """Enhanced base API test case."""

    def setUp(self):
        """Set up common API test data."""
        super().setUp()
        self.fake = fake

    def create_test_user(self, email=None, role='user', **kwargs):
        """Create a test user for API tests."""
        if email is None:
            email = fake.email()

        return User.objects.create_user(
            email=email,
            password=fake.password(),
            role=role,
            **kwargs
        )

    def authenticate_user(self, user=None):
        """Authenticate user for API requests."""
        if user is None:
            user = self.create_test_user()

        self.client.force_authenticate(user=user)
        return user


# Factory classes for creating test data
class UserFactory(factory.django.DjangoModelFactory):
    """Factory for creating test users."""

    class Meta:
        model = User
        django_get_or_create = ('email',)

    email = factory.LazyAttribute(lambda _: fake.email())
    password = factory.PostGenerationMethodCall('set_password', 'testpass123')
    role = factory.Iterator(['user', 'moderator', 'admin'])
    first_name = factory.LazyAttribute(lambda _: fake.first_name())
    last_name = factory.LazyAttribute(lambda _: fake.last_name())
    is_active = True


class AdminUserFactory(UserFactory):
    """Factory for creating admin users."""

    role = 'admin'
    is_staff = True
    is_superuser = True


class RoomFactory(factory.DictFactory):
    """Factory for creating test room data."""

    room_id = factory.LazyAttribute(lambda _: str(uuid.uuid4()))
    short_code = factory.LazyAttribute(lambda _: fake.lexify(text='??????', letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'))
    created_at = factory.LazyAttribute(lambda _: timezone.now().isoformat())
    participants = factory.List([])
    is_active = True
    expires_at = factory.LazyAttribute(
        lambda _: (timezone.now() + timezone.timedelta(hours=24)).isoformat()
    )
    max_participants = 15
    room_mode = 'p2p'


class ParticipantFactory(factory.DictFactory):
    """Factory for creating test participant data."""

    participant_id = factory.LazyAttribute(lambda _: str(uuid.uuid4()))
    joined_at = factory.LazyAttribute(lambda _: timezone.now().isoformat())
    ip_address = factory.LazyAttribute(lambda _: fake.ipv4())


# Test data generators
def generate_test_users(count=5, roles=None):
    """Generate multiple test users."""
    if roles is None:
        roles = ['user'] * count

    users = []
    for i in range(count):
        role = roles[i % len(roles)] if i < len(roles) else 'user'
        user = User.objects.create_user(
            email=f'test{i}@{fake.domain_name()}',
            password='testpass123',
            role=role,
            first_name=fake.first_name(),
            last_name=fake.last_name()
        )
        users.append(user)

    return users


def generate_test_rooms(count=3, participants_per_room=2):
    """Generate test rooms with participants."""
    from apps.rooms.models import RoomManager

    rooms = []
    for i in range(count):
        # Create room
        room_data = RoomManager.create_room(f'127.0.0.{i+1}')

        # Add participants
        for j in range(participants_per_room):
            participant_id = f'participant-{i}-{j}'
            RoomManager.join_room(
                room_data['room_id'],
                participant_id,
                f'192.168.{i+1}.{j+1}'
            )

        rooms.append(room_data)

    return rooms


# Mock utilities
class MockWebRTCPeerConnection:
    """Mock WebRTC peer connection for testing."""

    def __init__(self):
        self.connection_state = 'new'
        self.ice_connection_state = 'new'
        self.remote_streams = []
        self.local_streams = []

    async def createOffer(self, options=None):
        """Mock createOffer method."""
        return {
            'type': 'offer',
            'sdp': 'mock-sdp-offer'
        }

    async def createAnswer(self, options=None):
        """Mock createAnswer method."""
        return {
            'type': 'answer',
            'sdp': 'mock-sdp-answer'
        }

    async def setLocalDescription(self, description):
        """Mock setLocalDescription method."""
        pass

    async def setRemoteDescription(self, description):
        """Mock setRemoteDescription method."""
        pass

    async def addIceCandidate(self, candidate):
        """Mock addIceCandidate method."""
        pass

    async def getStats(self):
        """Mock getStats method."""
        return [
            {
                'type': 'inbound-rtp',
                'mediaType': 'video',
                'bytesReceived': 1000,
                'packetsReceived': 50,
                'packetsLost': 2,
                'frameWidth': 1920,
                'frameHeight': 1080,
                'framesPerSecond': 30
            },
            {
                'type': 'candidate-pair',
                'state': 'succeeded',
                'currentRoundTripTime': 0.05,
                'availableOutgoingBitrate': 1000000
            }
        ]

    def close(self):
        """Mock close method."""
        self.connection_state = 'closed'


class MockMediaStream:
    """Mock MediaStream for testing."""

    def __init__(self, tracks=None):
        self.tracks = tracks or []

    def getTracks(self):
        """Mock getTracks method."""
        return self.tracks

    def addTrack(self, track):
        """Mock addTrack method."""
        self.tracks.append(track)


class MockMediaStreamTrack:
    """Mock MediaStreamTrack for testing."""

    def __init__(self, kind='video'):
        self.kind = kind
        self.enabled = True
        self.id = f'mock-track-{uuid.uuid4()}'

    def stop(self):
        """Mock stop method."""
        self.enabled = False


# Test decorators
def skip_if_no_redis(func):
    """Skip test if Redis is not available."""
    def wrapper(*args, **kwargs):
        try:
            import redis
            return func(*args, **kwargs)
        except ImportError:
            pytest.skip("Redis not available")
    return wrapper


def slow_test(func):
    """Mark test as slow running."""
    func._slow_test = True
    return func


# Test data for performance testing
PERFORMANCE_TEST_DATA = {
    'small': {
        'users': 10,
        'rooms': 5,
        'participants_per_room': 2
    },
    'medium': {
        'users': 100,
        'rooms': 25,
        'participants_per_room': 4
    },
    'large': {
        'users': 1000,
        'rooms': 100,
        'participants_per_room': 10
    }
}


# Assertion helpers
class CustomAssertions:
    """Custom assertion methods for testing."""

    @staticmethod
    def assert_datetime_recent(dt, seconds=60):
        """Assert that datetime is recent."""
        from django.utils import timezone
        now = timezone.now()
        diff = abs((now - dt).total_seconds())
        assert diff < seconds, f"Datetime {dt} is not recent (diff: {diff}s)"

    @staticmethod
    def assert_user_has_permissions(user, permissions):
        """Assert that user has specific permissions."""
        for permission in permissions:
            assert user.has_permission(permission), f"User {user.email} missing permission: {permission}"

    @staticmethod
    def assert_room_is_valid(room_data):
        """Assert that room data is valid."""
        assert 'room_id' in room_data
        assert 'short_code' in room_data
        assert 'participants' in room_data
        assert 'is_active' in room_data
        assert 'created_at' in room_data
        assert 'expires_at' in room_data

        # Validate UUID format
        uuid.UUID(room_data['room_id'])

        # Validate short code format
        assert len(room_data['short_code']) >= 4
        assert room_data['short_code'].isalnum()


# Global test utilities instance
test_utils = CustomAssertions()