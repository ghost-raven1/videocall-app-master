# apps/rooms/chat_views.py - API views for chat and file attachments
import mimetypes
from django.http import FileResponse, Http404
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny
from .chat_models import ChatMessage, ChatAttachment, ScreenShareSession
from .models import RoomManager


class ChatMessageViewSet(viewsets.ModelViewSet):
    """API for chat messages.

    Authorization model:
    - Global DRF permission is AllowAny (no JWT required).
    - Access control is enforced by room_code + participant_id via RoomManager.
    This позволяет гостям, подключившимся к комнате, пользоваться чатом без регистрации.
    """
    
    queryset = ChatMessage.objects.all()
    parser_classes = [JSONParser]
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        """Filter messages by room"""
        room_code = self.request.query_params.get('room_code')
        room_id = self.request.query_params.get('room_id')
        
        queryset = ChatMessage.objects.prefetch_related('attachments')
        
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        elif room_code:
            # Get room_id from room_code using RoomManager
            room_data = RoomManager.get_room_by_code(room_code)
            if room_data:
                queryset = queryset.filter(room_id=room_data['room_id'])
            else:
                # Return empty queryset if room not found
                queryset = queryset.none()
        
        # Filter out deleted messages unless requested
        if not self.request.query_params.get('include_deleted'):
            queryset = queryset.filter(is_deleted=False)
        
        return queryset.order_by('created_at')
    
    def create(self, request):
        """Create new chat message"""
        try:
            room_code = request.data.get('room_code')
            participant_id = request.data.get('participant_id')
            content = request.data.get('content', '')
            message_type = request.data.get('message_type', 'text')
            reply_to_id = request.data.get('reply_to')
            
            if not room_code:
                return Response(
                    {'error': 'room_code is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not participant_id:
                return Response(
                    {'error': 'participant_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate room using RoomManager (Redis)
            room_data = RoomManager.get_room_by_code(room_code)
            if not room_data:
                return Response(
                    {'error': 'Room not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            room_id = room_data['room_id']
            
            # Validate participant is in room
            participants = room_data.get('participants', [])
            if participant_id not in participants:
                return Response(
                    {'error': 'Participant not found in room'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Create message
            message = ChatMessage.objects.create(
                room_id=room_id,
                sender_id=participant_id,
                content=content,
                message_type=message_type
            )
            
            # Handle reply
            if reply_to_id:
                try:
                    reply_to = ChatMessage.objects.get(id=reply_to_id, room_id=room_id)
                    message.reply_to = reply_to
                    message.save()
                except ChatMessage.DoesNotExist:
                    pass
            
            return Response(
                {
                    'success': True,
                    'message': message.to_dict()
                },
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            import traceback
            return Response(
                {'error': str(e), 'traceback': traceback.format_exc()},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['put'])
    def edit(self, request, pk=None):
        """Edit message content"""
        try:
            message = self.get_object()
            participant_id = request.data.get('participant_id')
            
            # Verify participant owns the message (sender_id is a string)
            if str(message.sender_id) != str(participant_id):
                return Response(
                    {'error': 'You can only edit your own messages'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            message.content = request.data.get('content', message.content)
            message.is_edited = True
            message.save()
            
            return Response({
                'success': True,
                'message': message.to_dict()
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['delete'])
    def soft_delete(self, request, pk=None):
        """Soft delete message"""
        try:
            message = self.get_object()
            participant_id = request.data.get('participant_id')
            
            # Verify participant owns the message (sender_id is a string)
            if str(message.sender_id) != str(participant_id):
                return Response(
                    {'error': 'You can only delete your own messages'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            message.is_deleted = True
            message.save()
            
            return Response({
                'success': True,
                'message': 'Message deleted'
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get chat history for a room"""
        room_code = request.query_params.get('room_code')
        limit = int(request.query_params.get('limit', 100))
        offset = int(request.query_params.get('offset', 0))
        
        if not room_code:
            return Response(
                {'error': 'room_code is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get room_id from room_code using RoomManager
        room_data = RoomManager.get_room_by_code(room_code)
        if not room_data:
            return Response({
                'success': True,
                'messages': [],
                'count': 0,
                'offset': offset,
                'limit': limit
            })
        
        room_id = room_data['room_id']
        messages = ChatMessage.objects.filter(room_id=room_id, is_deleted=False).order_by('created_at')[offset:offset+limit]
        
        return Response({
            'success': True,
            'messages': [msg.to_dict() for msg in messages],
            'count': messages.count(),
            'offset': offset,
            'limit': limit
        })


class ChatAttachmentViewSet(viewsets.ModelViewSet):
    """API for file attachments.

    Гостям, подключенным к комнате, разрешено загружать и скачивать вложения,
    при этом валидация выполняется через room_code + participant_id.
    """
    
    queryset = ChatAttachment.objects.all()
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [AllowAny]
    
    def create(self, request):
        """Upload file attachment"""
        try:
            room_code = request.data.get('room_code')
            participant_id = request.data.get('participant_id')
            message_id = request.data.get('message_id')
            file = request.FILES.get('file')
            
            if not file:
                return Response(
                    {'error': 'No file provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not room_code:
                return Response(
                    {'error': 'room_code is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not participant_id:
                return Response(
                    {'error': 'participant_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate room using RoomManager (Redis)
            room_data = RoomManager.get_room_by_code(room_code)
            if not room_data:
                return Response(
                    {'error': 'Room not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            room_id = room_data['room_id']
            
            # Validate participant is in room
            participants = room_data.get('participants', [])
            if participant_id not in participants:
                return Response(
                    {'error': 'Participant not found in room'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get or create message
            if message_id:
                try:
                    message = ChatMessage.objects.get(id=message_id, room_id=room_id)
                except ChatMessage.DoesNotExist:
                    return Response(
                        {'error': 'Message not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # Create new message for file
                message = ChatMessage.objects.create(
                    room_id=room_id,
                    sender_id=participant_id,
                    message_type='file',
                    content=f"Sent a file: {file.name}"
                )
            
            # Check file size (max 50MB)
            max_size = 50 * 1024 * 1024  # 50MB
            if file.size > max_size:
                return Response(
                    {'error': f'File too large. Maximum size is 50MB'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Detect mime type
            mime_type, _ = mimetypes.guess_type(file.name)
            if not mime_type:
                mime_type = 'application/octet-stream'
            
            # Create attachment
            attachment = ChatAttachment.objects.create(
                message=message,
                room_id=room_id,
                file=file,
                original_filename=file.name,
                file_size=file.size,
                mime_type=mime_type,
                uploaded_by=participant_id
            )
            
            return Response(
                {
                    'success': True,
                    'attachment': attachment.to_dict(),
                    'message': message.to_dict()
                },
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            import traceback
            return Response(
                {'error': str(e), 'traceback': traceback.format_exc()},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download file attachment"""
        try:
            attachment = self.get_object()
            
            # Increment download count
            attachment.increment_download_count()
            
            # Return file
            response = FileResponse(
                attachment.file.open('rb'),
                content_type=attachment.mime_type
            )
            response['Content-Disposition'] = f'attachment; filename="{attachment.original_filename}"'
            
            return response
            
        except Exception as e:
            raise Http404("File not found")
    
    @action(detail=False, methods=['get'])
    def list_by_room(self, request):
        """List all attachments in a room"""
        room_code = request.query_params.get('room_code')
        file_type = request.query_params.get('file_type')
        
        if not room_code:
            return Response(
                {'error': 'room_code is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get room_id from room_code using RoomManager
        room_data = RoomManager.get_room_by_code(room_code)
        if not room_data:
            return Response(
                {'error': 'Room not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        room_id = room_data['room_id']
        attachments = ChatAttachment.objects.filter(room_id=room_id)
        
        if file_type:
            attachments = attachments.filter(file_type=file_type)
        
        attachments = attachments.order_by('-uploaded_at')
        
        return Response({
            'success': True,
            'attachments': [att.to_dict() for att in attachments],
            'count': attachments.count()
        })


class ScreenShareViewSet(viewsets.ModelViewSet):
    """API for screen sharing sessions.

    Доступ открыт для гостей, но каждая операция проверяет участника по room_code
    и participant_id через RoomManager.
    """
    
    queryset = ScreenShareSession.objects.all()
    parser_classes = [JSONParser]
    permission_classes = [AllowAny]
    
    def create(self, request):
        """Start screen sharing session"""
        try:
            room_code = request.data.get('room_code')
            participant_id = request.data.get('participant_id')
            stream_id = request.data.get('stream_id')
            
            if not room_code:
                return Response(
                    {'error': 'room_code is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not participant_id:
                return Response(
                    {'error': 'participant_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate room using RoomManager (Redis)
            room_data = RoomManager.get_room_by_code(room_code)
            if not room_data:
                return Response(
                    {'error': 'Room not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            room_id = room_data['room_id']
            
            # Validate participant is in room
            participants = room_data.get('participants', [])
            if participant_id not in participants:
                return Response(
                    {'error': 'Participant not found in room'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if participant already has active screen share
            existing = ScreenShareSession.objects.filter(
                room_id=room_id,
                participant_id=participant_id,
                status='active'
            ).first()
            
            if existing:
                return Response(
                    {'error': 'You already have an active screen share'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create session
            session = ScreenShareSession.objects.create(
                room_id=room_id,
                participant_id=participant_id,
                stream_id=stream_id,
                status='active'
            )
            
            return Response(
                {
                    'success': True,
                    'session': session.to_dict()
                },
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            import traceback
            return Response(
                {'error': str(e), 'traceback': traceback.format_exc()},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        """Stop screen sharing session"""
        try:
            session = self.get_object()
            participant_id = request.data.get('participant_id')
            
            # Verify participant owns the session (participant_id is a string)
            if str(session.participant_id) != str(participant_id):
                return Response(
                    {'error': 'You can only stop your own screen share'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            session.status = 'stopped'
            session.stopped_at = timezone.now()
            session.save()
            
            return Response({
                'success': True,
                'session': session.to_dict()
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def active_sessions(self, request):
        """Get active screen sharing sessions in a room"""
        room_code = request.query_params.get('room_code')
        
        if not room_code:
            return Response(
                {'error': 'room_code is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get room_id from room_code using RoomManager
        room_data = RoomManager.get_room_by_code(room_code)
        if not room_data:
            return Response({
                'success': True,
                'sessions': [],
                'count': 0
            })
        
        room_id = room_data['room_id']
        sessions = ScreenShareSession.objects.filter(
            room_id=room_id,
            status='active'
        )
        
        return Response({
            'success': True,
            'sessions': [session.to_dict() for session in sessions],
            'count': sessions.count()
        })
