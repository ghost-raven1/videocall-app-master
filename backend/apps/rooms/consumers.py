# rooms/consumers.py - WebSocket consumer for WebRTC signaling
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from apps.rooms.models import RoomManager

logger = logging.getLogger(__name__)


class VideoCallConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for handling WebRTC signaling and room management.
    Implements secure peer-to-peer connection establishment.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.room_id = None
        self.room_group_name = None
        self.participant_id = None

    async def connect(self):
        """Handle WebSocket connection"""
        try:
            # Extract room ID from URL
            self.room_id = self.scope['url_route']['kwargs']['room_id']
            self.room_group_name = f'room_{self.room_id}'

            # Get participant ID from session or generate one
            session = self.scope.get('session', {})
            self.participant_id = session.get('session_key') or f'temp_{timezone.now().timestamp()}'

            # Verify room exists and user can join
            room_data = await self.get_room_data(self.room_id)

            if not room_data:
                await self.close(code=4004)  # Room not found
                return

            # Check room capacity
            participants = room_data.get('participants', [])
            max_participants = room_data.get('max_participants', 15)

            if len(participants) >= max_participants and self.participant_id not in participants:
                await self.close(code=4003)  # Room is full
                return

            # Join the room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )

            # Accept the WebSocket connection
            await self.accept()

            # Get SFU information for the room
            sfu_info = await self.get_room_sfu_info(self.room_id)

            # Notify other participants about new user
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_joined',
                    'participant_id': self.participant_id,
                    'timestamp': timezone.now().isoformat(),
                    'sfu_info': sfu_info
                }
            )

            logger.info(f"User {self.participant_id} connected to room {self.room_id}")

        except Exception as e:
            logger.error(f"WebSocket connection error: {e}")
            await self.close(code=4000)

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        try:
            if self.room_group_name and self.participant_id:
                # Notify other participants about user leaving
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_left',
                        'participant_id': self.participant_id,
                        'timestamp': timezone.now().isoformat()
                    }
                )

                # Remove user from room group
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    self.channel_name
                )

                # Update room data
                await self.leave_room(self.room_id, self.participant_id)

            logger.info(f"User {self.participant_id} disconnected from room {self.room_id}")

        except Exception as e:
            logger.error(f"WebSocket disconnect error: {e}")

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            # Validate message structure
            if not message_type:
                await self.send_error('Message type is required')
                return

            # Handle different message types
            if message_type == 'offer':
                await self.handle_webrtc_offer(data)
            elif message_type == 'answer':
                await self.handle_webrtc_answer(data)
            elif message_type == 'ice_candidate':
                await self.handle_ice_candidate(data)
            elif message_type == 'ping':
                await self.handle_ping()
            elif message_type == 'media_state':
                await self.handle_media_state(data)
            elif message_type == 'sfu_enabled':
                await self.handle_sfu_enabled(data)
            elif message_type == 'participant_list_request':
                await self.handle_participant_list_request()
            elif message_type == 'room_info_request':
                await self.handle_room_info_request()
            # Chat events
            elif message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'chat_message_edited':
                await self.handle_chat_message_edited(data)
            elif message_type == 'chat_message_deleted':
                await self.handle_chat_message_deleted(data)
            elif message_type == 'file_uploaded':
                await self.handle_file_uploaded(data)
            # Screen share events
            elif message_type == 'screen_share_started':
                await self.handle_screen_share_started(data)
            elif message_type == 'screen_share_stopped':
                await self.handle_screen_share_stopped(data)
            else:
                await self.send_error(f'Unknown message type: {message_type}')

        except json.JSONDecodeError:
            await self.send_error('Invalid JSON format')
        except Exception as e:
            logger.error(f"WebSocket receive error: {e}")
            await self.send_error('Message processing failed')

    async def handle_webrtc_offer(self, data):
        """Handle WebRTC offer from peer"""
        try:
            target_participant = data.get('target')
            offer = data.get('offer')

            if not offer:
                await self.send_error('Offer data is required')
                return

            # Forward offer to target participant or broadcast to room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'webrtc_offer',
                    'offer': offer,
                    'sender': self.participant_id,
                    'target': target_participant,
                    'timestamp': timezone.now().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"WebRTC offer handling error: {e}")
            await self.send_error('Failed to process offer')

    async def handle_webrtc_answer(self, data):
        """Handle WebRTC answer from peer"""
        try:
            target_participant = data.get('target')
            answer = data.get('answer')

            if not answer:
                await self.send_error('Answer data is required')
                return

            # Forward answer to target participant
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'webrtc_answer',
                    'answer': answer,
                    'sender': self.participant_id,
                    'target': target_participant,
                    'timestamp': timezone.now().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"WebRTC answer handling error: {e}")
            await self.send_error('Failed to process answer')

    async def handle_ice_candidate(self, data):
        """Handle ICE candidate exchange"""
        try:
            target_participant = data.get('target')
            candidate = data.get('candidate')

            if not candidate:
                await self.send_error('ICE candidate data is required')
                return

            # Forward ICE candidate to target participant
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'ice_candidate',
                    'candidate': candidate,
                    'sender': self.participant_id,
                    'target': target_participant,
                    'timestamp': timezone.now().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"ICE candidate handling error: {e}")
            await self.send_error('Failed to process ICE candidate')

    async def handle_ping(self):
        """Handle ping message for connection health check"""
        await self.send(text_data=json.dumps({
            'type': 'pong',
            'timestamp': timezone.now().isoformat()
        }))

    async def handle_media_state(self, data):
        """Handle media state changes (mute/unmute, video on/off)"""
        try:
            media_state = data.get('state', {})

            # Broadcast media state to other participants
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'media_state_update',
                    'participant_id': self.participant_id,
                    'state': media_state,
                    'timestamp': timezone.now().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"Media state handling error: {e}")
            await self.send_error('Failed to process media state')

    async def handle_sfu_enabled(self, data):
        """Handle SFU enabled notification"""
        try:
            sfu_room_id = data.get('sfu_room_id')
            sfu_ws_url = data.get('sfu_ws_url')

            # Broadcast SFU enabled event to all participants
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'sfu_enabled',
                    'sfu_room_id': sfu_room_id,
                    'sfu_ws_url': sfu_ws_url,
                    'timestamp': timezone.now().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"SFU enabled handling error: {e}")
            await self.send_error('Failed to process SFU enabled notification')

    async def handle_participant_list_request(self):
        """Handle request for current participant list"""
        try:
            room_data = await self.get_room_data(self.room_id)
            participants = room_data.get('participants', []) if room_data else []
            sfu_info = await self.get_room_sfu_info(self.room_id)

            await self.send(text_data=json.dumps({
                'type': 'participant_list',
                'participants': participants,
                'participant_count': len(participants),
                'sfu_info': sfu_info,
                'timestamp': timezone.now().isoformat()
            }))

        except Exception as e:
            logger.error(f"Participant list request handling error: {e}")
            await self.send_error('Failed to get participant list')

    async def handle_room_info_request(self):
        """Handle request for room information"""
        try:
            room_data = await self.get_room_data(self.room_id)
            sfu_info = await self.get_room_sfu_info(self.room_id)

            if not room_data:
                await self.send_error('Room not found')
                return

            room_info = {
                'room_id': room_data.get('room_id'),
                'short_code': room_data.get('short_code'),
                'created_at': room_data.get('created_at'),
                'max_participants': room_data.get('max_participants', 15),
                'current_participants': len(room_data.get('participants', [])),
                'room_mode': room_data.get('room_mode', 'p2p'),
                'sfu_info': sfu_info
            }

            await self.send(text_data=json.dumps({
                'type': 'room_info',
                'room_info': room_info,
                'timestamp': timezone.now().isoformat()
            }))

        except Exception as e:
            logger.error(f"Room info request handling error: {e}")
            await self.send_error('Failed to get room information')

    # Group message handlers
    async def user_joined(self, event):
        """Send user joined notification"""
        if event['participant_id'] != self.participant_id:
            await self.send(text_data=json.dumps({
                'type': 'user_joined',
                'participant_id': event['participant_id'],
                'timestamp': event['timestamp'],
                'sfu_info': event.get('sfu_info')
            }))

    async def user_left(self, event):
        """Send user left notification"""
        if event['participant_id'] != self.participant_id:
            await self.send(text_data=json.dumps({
                'type': 'user_left',
                'participant_id': event['participant_id'],
                'timestamp': event['timestamp']
            }))

    async def webrtc_offer(self, event):
        """Forward WebRTC offer to client"""
        # Only send to target participant or broadcast if no target specified
        if not event.get('target') or event['target'] == self.participant_id:
            if event['sender'] != self.participant_id:
                await self.send(text_data=json.dumps({
                    'type': 'webrtc_offer',
                    'offer': event['offer'],
                    'sender': event['sender'],
                    'timestamp': event['timestamp']
                }))

    async def webrtc_answer(self, event):
        """Forward WebRTC answer to client"""
        if event.get('target') == self.participant_id:
            await self.send(text_data=json.dumps({
                'type': 'webrtc_answer',
                'answer': event['answer'],
                'sender': event['sender'],
                'timestamp': event['timestamp']
            }))

    async def ice_candidate(self, event):
        """Forward ICE candidate to client"""
        # Only send to target participant or broadcast if no target specified
        if not event.get('target') or event['target'] == self.participant_id:
            if event['sender'] != self.participant_id:
                await self.send(text_data=json.dumps({
                    'type': 'ice_candidate',
                    'candidate': event['candidate'],
                    'sender': event['sender'],
                    'timestamp': event['timestamp']
                }))

    async def media_state_update(self, event):
        """Forward media state update to client"""
        if event['participant_id'] != self.participant_id:
            await self.send(text_data=json.dumps({
                'type': 'media_state_update',
                'participant_id': event['participant_id'],
                'state': event['state'],
                'timestamp': event['timestamp']
            }))

    async def sfu_enabled(self, event):
        """Forward SFU enabled notification to client"""
        await self.send(text_data=json.dumps({
            'type': 'sfu_enabled',
            'sfu_room_id': event['sfu_room_id'],
            'sfu_ws_url': event['sfu_ws_url'],
            'timestamp': event['timestamp']
        }))

    # Chat message handlers
    async def handle_chat_message(self, data):
        """Handle new chat message"""
        try:
            message = data.get('message')
            if not message:
                await self.send_error('Message data is required')
                return
            
            # Broadcast to all participants in room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message_broadcast',
                    'message': message,
                    'sender': self.participant_id,
                    'timestamp': timezone.now().isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Chat message handling error: {e}")
            await self.send_error('Failed to send chat message')
    
    async def handle_chat_message_edited(self, data):
        """Handle edited chat message"""
        try:
            message = data.get('message')
            if not message:
                await self.send_error('Message data is required')
                return
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message_edited_broadcast',
                    'message': message,
                    'timestamp': timezone.now().isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Chat message edit handling error: {e}")
    
    async def handle_chat_message_deleted(self, data):
        """Handle deleted chat message"""
        try:
            message_id = data.get('message_id')
            if not message_id:
                await self.send_error('Message ID is required')
                return
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message_deleted_broadcast',
                    'message_id': message_id,
                    'timestamp': timezone.now().isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Chat message delete handling error: {e}")
    
    async def handle_file_uploaded(self, data):
        """Handle file upload notification"""
        try:
            attachment = data.get('attachment')
            message = data.get('message')
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'file_uploaded_broadcast',
                    'attachment': attachment,
                    'message': message,
                    'timestamp': timezone.now().isoformat()
                }
            )
        except Exception as e:
            logger.error(f"File upload handling error: {e}")
    
    # Screen share handlers
    async def handle_screen_share_started(self, data):
        """Handle screen share started"""
        try:
            session = data.get('session')
            if not session:
                await self.send_error('Session data is required')
                return
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'screen_share_started_broadcast',
                    'session': session,
                    'participant_id': self.participant_id,
                    'timestamp': timezone.now().isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Screen share start handling error: {e}")
    
    async def handle_screen_share_stopped(self, data):
        """Handle screen share stopped"""
        try:
            session_id = data.get('session_id')
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'screen_share_stopped_broadcast',
                    'session_id': session_id,
                    'participant_id': self.participant_id,
                    'timestamp': timezone.now().isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Screen share stop handling error: {e}")
    
    # Broadcast handlers for chat and screen share
    async def chat_message_broadcast(self, event):
        """Broadcast chat message to client"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender': event['sender'],
            'timestamp': event['timestamp']
        }))
    
    async def chat_message_edited_broadcast(self, event):
        """Broadcast edited message to client"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message_edited',
            'message': event['message'],
            'timestamp': event['timestamp']
        }))
    
    async def chat_message_deleted_broadcast(self, event):
        """Broadcast deleted message to client"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message_deleted',
            'message_id': event['message_id'],
            'timestamp': event['timestamp']
        }))
    
    async def file_uploaded_broadcast(self, event):
        """Broadcast file upload to client"""
        await self.send(text_data=json.dumps({
            'type': 'file_uploaded',
            'attachment': event['attachment'],
            'message': event['message'],
            'timestamp': event['timestamp']
        }))
    
    async def screen_share_started_broadcast(self, event):
        """Broadcast screen share started to client"""
        await self.send(text_data=json.dumps({
            'type': 'screen_share_started',
            'session': event['session'],
            'participant_id': event['participant_id'],
            'timestamp': event['timestamp']
        }))
    
    async def screen_share_stopped_broadcast(self, event):
        """Broadcast screen share stopped to client"""
        await self.send(text_data=json.dumps({
            'type': 'screen_share_stopped',
            'session_id': event['session_id'],
            'participant_id': event['participant_id'],
            'timestamp': event['timestamp']
        }))

    # Helper methods
    async def send_error(self, error_message):
        """Send error message to client"""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': error_message,
            'timestamp': timezone.now().isoformat()
        }))

    @database_sync_to_async
    def get_room_data(self, room_id):
        """Get room data from Redis"""
        return RoomManager.get_room_by_id(room_id)

    @database_sync_to_async
    def leave_room(self, room_id, participant_id):
        """Remove participant from room"""
        return RoomManager.leave_room(room_id, participant_id)

    @database_sync_to_async
    def get_room_sfu_info(self, room_id):
        """Get SFU information for a room"""
        return RoomManager.get_room_sfu_info(room_id)
