# rooms/consumers_sfu.py - WebSocket consumer for SFU server communication
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
import asyncio

logger = logging.getLogger(__name__)

class SFUConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for handling SFU server communication.
    This consumer handles the WebSocket connection from the SFU server.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.room_group_name = 'sfu_server'
        self.sfu_id = None

    async def connect(self):
        """Handle WebSocket connection from SFU server"""
        try:
            # Accept the connection
            await self.accept()
            
            # Add to SFU group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            # Generate a unique ID for this SFU connection
            self.sfu_id = f'sfu_{timezone.now().timestamp()}'
            
            logger.info(f"SFU server connected: {self.sfu_id}")
            
            # Send connection acknowledgment
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': 'Connected to Django backend',
                'sfu_id': self.sfu_id
            }))
            
        except Exception as e:
            logger.error(f"SFU connection error: {str(e)}")
            await self.close(code=4000)

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Remove from SFU group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        logger.info(f"SFU server disconnected: {self.sfu_id}")

    async def receive(self, text_data):
        """Handle incoming WebSocket messages from SFU server"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'health_check':
                # Handle health check from SFU
                await self.send(text_data=json.dumps({
                    'type': 'health_response',
                    'status': 'ok',
                    'timestamp': timezone.now().isoformat()
                }))
                
            elif message_type == 'room_event':
                # Handle room events from SFU (e.g., room created, user joined, etc.)
                room_id = data.get('room_id')
                event = data.get('event', {})
                
                # Forward the event to the room group
                await self.channel_layer.group_send(
                    f'room_{room_id}',
                    {
                        'type': 'sfu_message',
                        'message': event
                    }
                )
                
        except json.JSONDecodeError:
            logger.error("Invalid JSON received from SFU")
        except Exception as e:
            logger.error(f"Error processing SFU message: {str(e)}")

    async def sfu_message(self, event):
        """Handle messages to be sent to the SFU server"""
        # Send message to SFU server
        await self.send(text_data=json.dumps(event['message']))

    async def room_message(self, event):
        """Handle room messages to be sent to the SFU server"""
        # Forward room messages to SFU server
        await self.send(text_data=json.dumps({
            'type': 'room_message',
            'room_id': event['room_id'],
            'message': event['message']
        }))
