"""
Pytest configuration and shared fixtures for the videocall application.
"""
import os
import pytest
import django
from django.conf import settings
from django.test import Client
from django.contrib.auth import get_user_model
from faker import Faker
import asyncio

# Setup Django BEFORE importing DRF classes
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'videocall_app.settings')
django.setup()

# Import DRF and channels AFTER Django setup
from rest_framework.test import APITestCase
from channels.testing import WebsocketCommunicator

User = get_user_model()
fake = Faker()

# Database configuration for tests
TEST_DB_CONFIG = {
    'ENGINE': 'django.db.backends.sqlite3',
    'NAME': ':memory:',
}

# Override Django settings for tests
if not settings.configured:
    settings.configure(
        DEBUG=True,
        DATABASES={
            'default': TEST_DB_CONFIG
        },
        INSTALLED_APPS=[
            'django.contrib.auth',
            'django.contrib.contenttypes',
            'django.contrib.sessions',
            'django.contrib.messages',
            'django.contrib.admin',
            'rest_framework',
            'rest_framework_simplejwt',
            'channels',
            'authentication',
            'core',
            'rooms',
        ],
        SECRET_KEY='test-secret-key-for-testing-only',
        USE_TZ=True,
        ROOT_URLCONF='videocall_app.urls',
        MIDDLEWARE=[
            'django.middleware.security.SecurityMiddleware',
            'django.contrib.sessions.middleware.SessionMiddleware',
            'django.middleware.common.CommonMiddleware',
            'django.middleware.csrf.CsrfViewMiddleware',
            'django.contrib.auth.middleware.AuthenticationMiddleware',
            'django.contrib.messages.middleware.MessageMiddleware',
        ],
        REST_FRAMEWORK={
            'DEFAULT_AUTHENTICATION_CLASSES': [
                'rest_framework_simplejwt.authentication.JWTAuthentication',
            ],
            'DEFAULT_PERMISSION_CLASSES': [
                'rest_framework.permissions.IsAuthenticated',
            ],
        },
        JWT_COOKIE_SETTINGS={
            'ACCESS_TOKEN_COOKIE_NAME': 'access_token',
            'REFRESH_TOKEN_COOKIE_NAME': 'refresh_token',
            'ACCESS_TOKEN_COOKIE_HTTPONLY': True,
            'ACCESS_TOKEN_COOKIE_SECURE': False,  # Allow HTTP for testing
            'REFRESH_TOKEN_COOKIE_HTTPONLY': True,
            'REFRESH_TOKEN_COOKIE_SECURE': False,
        },
    )


# Removed custom django_db_setup - using pytest-django's built-in fixture


@pytest.fixture
def api_client():
    """Return authenticated API client."""
    return Client()


@pytest.fixture
def authenticated_client():
    """Return authenticated API client with JWT cookies."""
    client = Client()

    # Create test user
    user = User.objects.create_user(
        email='test@example.com',
        password='testpass123',
        role='admin'
    )

    # Login to get JWT cookies
    response = client.post('/api/auth/token/', {
        'email': 'test@example.com',
        'password': 'testpass123'
    })

    if response.status_code == 200:
        # Extract cookies from response
        access_cookie = response.cookies.get('access_token')
        refresh_cookie = response.cookies.get('refresh_token')

        if access_cookie and refresh_cookie:
            client.cookies['access_token'] = access_cookie.value
            client.cookies['refresh_token'] = refresh_cookie.value

    return client, user


@pytest.fixture
def unauthenticated_client():
    """Return unauthenticated API client."""
    return Client()


@pytest.fixture
def test_user(db):
    """Create a test user."""
    return User.objects.create_user(
        email='test@example.com',
        password='testpass123',
        role='user'
    )


@pytest.fixture
def admin_user(db):
    """Create an admin user."""
    return User.objects.create_user(
        email='admin@example.com',
        password='admin123',
        role='admin'
    )


@pytest.fixture
def moderator_user(db):
    """Create a moderator user."""
    return User.objects.create_user(
        email='moderator@example.com',
        password='mod123',
        role='moderator'
    )


@pytest.fixture
def test_room(db):
    """Create a test room."""
    from apps.rooms.models import Room

    return Room.objects.create(
        host=test_user,
        name='Test Room',
        short_code='TEST123',
        is_active=True
    )


@pytest.fixture
def websocket_communicator():
    """Create a WebSocket communicator for testing."""
    from videocall_app.asgi import application

    async def _get_communicator(room_id: str = "test-room"):
        """Return WebSocketCommunicator bound to a specific test room.

        Defaults to room_id="test-room" to align with current routing
        pattern `/ws/room/<room_id>/`.
        """
        return WebsocketCommunicator(application, f"/ws/room/{room_id}/")

    return _get_communicator


@pytest.fixture
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# Factory fixtures for creating test data
@pytest.fixture
def user_factory():
    """Factory for creating test users."""
    def create_user(email=None, role='user', **kwargs):
        if email is None:
            email = fake.email()

        return User.objects.create_user(
            email=email,
            password=fake.password(),
            role=role,
            **kwargs
        )
    return create_user


@pytest.fixture
def room_factory(user_factory):
    """Factory for creating test rooms."""
    def create_room(host=None, **kwargs):
        if host is None:
            host = user_factory()

        from apps.rooms.models import Room

        return Room.objects.create(
            host=host,
            name=fake.company(),
            short_code=fake.lexify(text='??????', letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
            **kwargs
        )
    return create_room


# Async fixtures
@pytest.fixture
async def async_api_client():
    """Async API client for testing async views."""
    return Client()


@pytest.fixture
async def async_authenticated_client():
    """Async authenticated API client."""
    client = Client()

    # Create test user
    user = await User.objects.acreate_user(
        email='async_test@example.com',
        password='async123',
        role='user'
    )

    # Login to get JWT cookies
    response = client.post('/api/auth/token/', {
        'email': 'async_test@example.com',
        'password': 'async123'
    })

    if response.status_code == 200:
        access_cookie = response.cookies.get('access_token')
        refresh_cookie = response.cookies.get('refresh_token')

        if access_cookie and refresh_cookie:
            client.cookies['access_token'] = access_cookie.value
            client.cookies['refresh_token'] = refresh_cookie.value

    return client, user
