# rooms/routing.py - WebSocket URL routing
from django.urls import path, re_path
from apps.rooms.consumers import VideoCallConsumer
from apps.rooms.consumers_sfu import SFUConsumer

websocket_urlpatterns = [
    # Room WebSocket endpoint for clients
    path('ws/room/<str:room_id>/', VideoCallConsumer.as_asgi()),

    # SFU server WebSocket endpoint
    path('ws/sfu/', SFUConsumer.as_asgi()),
]
