# apps/rooms/chat_views.py - API views for chat and file attachments
import mimetypes
from django.http import FileResponse, Http404
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .chat_models import ChatMessage, ChatAttachment, ScreenShareSession
from .models import Room, RoomParticipant


class ChatMessageViewSet(viewsets.ModelViewSet):
    """API for chat messages"""
    
    queryset = ChatMessage.objects.all()
    parser_classes = [JSONParser]
    
    def get_queryset(self):
        """Filter messages by room"""
        room_code = self.request.query_params.get('room_code')
        room_id = self.request.query_params.get('room_id')
        
        queryset = ChatMessage.objects.select_related('participant', 'room').prefetch_related('attachments')
        
        if room_code:
            queryset = queryset.filter(room__code=room_code)
        elif room_id:
            queryset = queryset.filter(room__id=room_id)
        
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
            
            # Validate room
            try:
                room = Room.objects.get(code=room_code)
            except Room.DoesNotExist:
                return Response(
                    {'error': 'Room not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Validate participant
            try:
                participant = RoomParticipant.objects.get(
                    id=participant_id,
                    room=room,
                    status='active'
                )
            except RoomParticipant.DoesNotExist:
                return Response(
                    {'error': 'Participant not found or not active'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Create message
            message = ChatMessage.objects.create(
                room=room,
                participant=participant,
                content=content,
                message_type=message_type
            )
            
            # Handle reply
            if reply_to_id:
                try:
                    reply_to = ChatMessage.objects.get(id=reply_to_id, room=room)
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
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['put'])
    def edit(self, request, pk=None):
        """Edit message content"""
        try:
            message = self.get_object()
            participant_id = request.data.get('participant_id')
            
            # Verify participant owns the message
            if str(message.participant.id) != str(participant_id):
                return Response(
                    {'error': 'You can only edit your own messages'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            message.content = request.data.get('content', message.content)
            message.edited_at = timezone.now()
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
            
            # Verify participant owns the message
            if str(message.participant.id) != str(participant_id):
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
        
        messages = self.get_queryset().filter(room__code=room_code)[offset:offset+limit]
        
        return Response({
            'success': True,
            'messages': [msg.to_dict() for msg in messages],
            'count': messages.count(),
            'offset': offset,
            'limit': limit
        })


class ChatAttachmentViewSet(viewsets.ModelViewSet):
    """API for file attachments"""
    
    queryset = ChatAttachment.objects.all()
    parser_classes = [MultiPartParser, FormParser]
    
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
            
            # Validate room
            try:
                room = Room.objects.get(code=room_code)
            except Room.DoesNotExist:
                return Response(
                    {'error': 'Room not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Validate participant
            try:
                participant = RoomParticipant.objects.get(
                    id=participant_id,
                    room=room,
                    status='active'
                )
            except RoomParticipant.DoesNotExist:
                return Response(
                    {'error': 'Participant not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get or create message
            if message_id:
                try:
                    message = ChatMessage.objects.get(id=message_id, room=room)
                except ChatMessage.DoesNotExist:
                    return Response(
                        {'error': 'Message not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # Create new message for file
                message = ChatMessage.objects.create(
                    room=room,
                    participant=participant,
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
                room=room,
                file=file,
                original_filename=file.name,
                file_size=file.size,
                mime_type=mime_type,
                uploaded_by=participant
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
            return Response(
                {'error': str(e)},
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
        
        attachments = ChatAttachment.objects.filter(room__code=room_code)
        
        if file_type:
            attachments = attachments.filter(file_type=file_type)
        
        attachments = attachments.order_by('-uploaded_at')
        
        return Response({
            'success': True,
            'attachments': [att.to_dict() for att in attachments],
            'count': attachments.count()
        })


class ScreenShareViewSet(viewsets.ModelViewSet):
    """API for screen sharing sessions"""
    
    queryset = ScreenShareSession.objects.all()
    parser_classes = [JSONParser]
    
    def create(self, request):
        """Start screen sharing session"""
        try:
            room_code = request.data.get('room_code')
            participant_id = request.data.get('participant_id')
            stream_id = request.data.get('stream_id')
            
            # Validate room
            try:
                room = Room.objects.get(code=room_code)
            except Room.DoesNotExist:
                return Response(
                    {'error': 'Room not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Validate participant
            try:
                participant = RoomParticipant.objects.get(
                    id=participant_id,
                    room=room,
                    status='active'
                )
            except RoomParticipant.DoesNotExist:
                return Response(
                    {'error': 'Participant not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if participant already has active screen share
            existing = ScreenShareSession.objects.filter(
                participant=participant,
                status='active'
            ).first()
            
            if existing:
                return Response(
                    {'error': 'You already have an active screen share'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create session
            session = ScreenShareSession.objects.create(
                room=room,
                participant=participant,
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
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        """Stop screen sharing session"""
        try:
            session = self.get_object()
            participant_id = request.data.get('participant_id')
            
            # Verify participant owns the session
            if str(session.participant.id) != str(participant_id):
                return Response(
                    {'error': 'You can only stop your own screen share'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            session.stop()
            
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
        
        sessions = ScreenShareSession.objects.filter(
            room__code=room_code,
            status='active'
        ).select_related('participant', 'room')
        
        return Response({
            'success': True,
            'sessions': [session.to_dict() for session in sessions],
            'count': sessions.count()
        })
