# rooms/routing.py - WebSocket URL routing
from django.urls import path, re_path
from apps.rooms import consumers

websocket_urlpatterns = [
    # Room WebSocket endpoint for clients
    path('ws/room/<str:room_id>/', consumers.VideoCallConsumer.as_asgi()),
    
    # SFU server WebSocket endpoint
    path('ws/sfu/', consumers.SFUConsumer.as_asgi()),
]
