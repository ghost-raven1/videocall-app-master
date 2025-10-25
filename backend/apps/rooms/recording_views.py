# apps/rooms/recording_views.py - API for recording management
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import FileResponse, Http404
from .recording_models import Recording
from .models import Room, RoomParticipant
import logging

logger = logging.getLogger(__name__)


class RecordingViewSet(viewsets.ModelViewSet):
    """API for managing call recordings"""
    
    queryset = Recording.objects.all()
    permission_classes = [AllowAny]  # Can be restricted based on requirements
    
    def get_queryset(self):
        """Filter recordings by room"""
        room_code = self.request.query_params.get('room_code')
        if room_code:
            return Recording.objects.filter(room__code=room_code)
        return Recording.objects.all()
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        """Start recording a room"""
        try:
            room_code = request.data.get('room_code')
            participant_id = request.data.get('participant_id')
            
            # Validate room
            try:
                room = Room.objects.get(code=room_code)
            except Room.DoesNotExist:
                return Response({'error': 'Room not found'}, status=404)
            
            # Check if already recording
            active_recording = Recording.objects.filter(
                room=room,
                status='recording'
            ).first()
            
            if active_recording:
                return Response({'error': 'Recording already in progress'}, status=400)
            
            # Get participant
            participant = None
            if participant_id:
                try:
                    participant = RoomParticipant.objects.get(id=participant_id, room=room)
                except RoomParticipant.DoesNotExist:
                    pass
            
            # Create recording
            recording = Recording.objects.create(
                room=room,
                started_by=participant,
                include_audio=request.data.get('include_audio', True),
                include_video=request.data.get('include_video', True),
                include_screen_share=request.data.get('include_screen_share', True)
            )
            
            logger.info(f"Recording started for room {room_code}: {recording.id}")
            
            return Response({
                'success': True,
                'recording': recording.to_dict()
            }, status=201)
            
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            return Response({'error': str(e)}, status=500)
    
    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        """Stop recording"""
        try:
            recording = self.get_object()
            
            if recording.status != 'recording':
                return Response({'error': 'Recording is not active'}, status=400)
            
            recording.stop()
            
            logger.info(f"Recording stopped: {recording.id}")
            
            return Response({
                'success': True,
                'recording': recording.to_dict()
            })
            
        except Exception as e:
            logger.error(f"Failed to stop recording: {e}")
            return Response({'error': str(e)}, status=500)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download recording file"""
        try:
            recording = self.get_object()
            
            if recording.status != 'completed':
                return Response({'error': 'Recording not ready'}, status=400)
            
            if not recording.file:
                return Response({'error': 'File not found'}, status=404)
            
            recording.increment_download_count()
            
            response = FileResponse(
                recording.file.open('rb'),
                content_type='video/webm'
            )
            response['Content-Disposition'] = f'attachment; filename="recording_{recording.room.code}_{recording.started_at.strftime("%Y%m%d_%H%M%S")}.webm"'
            
            return response
            
        except Exception as e:
            logger.error(f"Failed to download recording: {e}")
            raise Http404("Recording file not found")
    
    @action(detail=False, methods=['get'])
    def list_by_room(self, request):
        """List all recordings for a room"""
        room_code = request.query_params.get('room_code')
        
        if not room_code:
            return Response({'error': 'room_code is required'}, status=400)
        
        recordings = Recording.objects.filter(room__code=room_code).order_by('-started_at')
        
        return Response({
            'success': True,
            'recordings': [rec.to_dict() for rec in recordings],
            'count': recordings.count()
        })
