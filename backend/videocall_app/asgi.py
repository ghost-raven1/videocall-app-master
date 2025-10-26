# videocall_app/asgi.py - ASGI configuration for WebSocket support
import os
from django.core.asgi import get_asgi_application

# Set the default Django settings module before importing other modules
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'videocall_app.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

# Now import other modules that depend on Django being initialized
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

# Import websocket_urlpatterns after Django is initialized
from apps.rooms.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
