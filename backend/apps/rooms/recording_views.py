# apps/rooms/recording_views.py - API for recording management
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import FileResponse, Http404
from django.core.files.base import ContentFile
from django.conf import settings
from .recording_models import Recording
import logging

logger = logging.getLogger(__name__)


class RecordingViewSet(viewsets.ModelViewSet):
    """API for managing call recordings"""
    
    queryset = Recording.objects.all()
    permission_classes = [AllowAny]  # Can be restricted based on requirements
    
    def get_queryset(self):
        """Filter recordings by room"""
        room_id = self.request.query_params.get('room_id')
        if room_id:
            return Recording.objects.filter(room_id=room_id)
        return Recording.objects.all()
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        """Start recording a room"""
        try:
            room_id = request.data.get('room_id')
            room_code = request.data.get('room_code')
            participant_id = request.data.get('participant_id')
            
            logger.info(f"Recording start request: room_id={room_id}, room_code={room_code}, participant_id={participant_id}")
            
            # If room_code provided, convert to room_id
            if not room_id and room_code:
                from apps.rooms.models import RoomManager
                logger.info(f"Converting room_code to room_id: {room_code}")
                room_data = RoomManager.get_room_by_code(room_code)
                if not room_data:
                    logger.warning(f"Room not found for room_code: {room_code}")
                    return Response({'error': 'Room not found'}, status=404)
                room_id = room_data.get('room_id')
                logger.info(f"Room found: room_id={room_id} for room_code={room_code}")
            
            if not room_id:
                logger.error(f"Missing room_id: room_id={room_id}, room_code={room_code}")
                return Response({'error': 'room_id or room_code is required'}, status=400)
            
            # Check if already recording
            active_recording = Recording.objects.filter(
                room_id=room_id,
                status='recording'
            ).first()
            
            if active_recording:
                return Response({'error': 'Recording already in progress'}, status=400)
            
            # Create new recording
            recording = Recording.objects.create(
                room_id=room_id,
                created_by_id=participant_id,
                status='recording',
                include_audio=request.data.get('include_audio', True),
                include_video=request.data.get('include_video', True),
                include_screen_share=request.data.get('include_screen_share', True)
            )
            
            logger.info(f"Recording started for room {room_id}: {recording.id}")
            
            return Response({
                'success': True,
                'recording': recording.to_dict()
            }, status=201)
            
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            return Response({'error': str(e)}, status=500)
    
    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        """Stop recording.

        В продакшене запись обычно обрабатывается отдельным процессом (FFmpeg/SFU),
        который выставляет status='completed' и прикрепляет файл. Для локальной разработки
        и демо-окружения (DEBUG=True) мы создаём минимальный пустой .webm-файл и сразу
        помечаем запись как completed, чтобы endpoint download работал end‑to‑end.
        """
        try:
            recording = self.get_object()
            
            if recording.status != 'recording':
                return Response({'error': 'Recording is not active'}, status=400)
            
            # Переводим запись в состояние "processing" и считаем длительность
            recording.stop()

            # В dev/DEBUG режиме создаём заглушку файла и помечаем запись завершённой,
            # чтобы скачивание работало сразу.
            if getattr(settings, 'DEBUG', False):
                try:
                    if not recording.file:
                        dummy_content = ContentFile(b'', name=f"{recording.id}.webm")
                        recording.file.save(dummy_content.name, dummy_content, save=False)
                    file_size = recording.file.size or 0
                    recording.mark_completed(file_size=file_size)
                except Exception as e:
                    logger.warning(f"Failed to create dummy recording file for {recording.id}: {e}")
            
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
            
            # Get room code from RoomManager if available
            room_code = recording.room_id
            try:
                from .models import RoomManager
                room_data = RoomManager.get_room_by_id(recording.room_id)
                if room_data and room_data.get('short_code'):
                    room_code = room_data['short_code']
            except Exception:
                pass  # Use room_id if RoomManager fails
            
            # Generate filename
            filename = f"recording_{room_code}_{recording.started_at.strftime('%Y%m%d_%H%M%S')}.webm"
            
            response = FileResponse(
                recording.file.open('rb'),
                content_type='video/webm'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            return response
            
        except Exception as e:
            logger.error(f"Failed to download recording: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return Response({'error': str(e)}, status=404)
    
    @action(detail=False, methods=['get'])
    def list_by_room(self, request):
        """List all recordings for a room"""
        from .models import RoomManager
        
        room_code = request.query_params.get('room_code')
        
        if not room_code:
            return Response({'error': 'room_code is required'}, status=400)
        
        try:
            # Get room data by code to find room_id
            room_data = RoomManager.get_room_by_code(room_code)
            
            if not room_data:
                return Response({
                    'success': True,
                    'recordings': [],
                    'count': 0,
                    'message': 'Room not found'
                })
            
            room_id = room_data.get('room_id')
            
            # Filter recordings by room_id
            recordings = Recording.objects.filter(room_id=room_id).order_by('-started_at')
            
            return Response({
                'success': True,
                'recordings': [rec.to_dict() for rec in recordings],
                'count': recordings.count()
            })
        except Exception as e:
            logger.error(f"Failed to list recordings by room code: {e}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=500)
