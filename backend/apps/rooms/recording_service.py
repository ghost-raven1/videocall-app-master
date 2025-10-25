# apps/rooms/recording_service.py - Recording service with FFmpeg
import subprocess
import os
import logging
from django.conf import settings
from .recording_models import Recording

logger = logging.getLogger(__name__)


class RecordingService:
    """Service for managing video call recordings using FFmpeg"""
    
    def __init__(self):
        self.ffmpeg_path = self._find_ffmpeg()
        self.storage_path = settings.RECORDING_STORAGE_PATH
        self.max_duration = settings.RECORDING_MAX_DURATION
        self.format = settings.RECORDING_FORMAT
    
    def _find_ffmpeg(self):
        """Find FFmpeg executable"""
        try:
            result = subprocess.run(['which', 'ffmpeg'], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
            return 'ffmpeg'  # Assume it's in PATH
        except Exception:
            return 'ffmpeg'
    
    def start_recording(self, recording_id, stream_url, output_path=None):
        """
        Start recording a stream
        
        Args:
            recording_id: UUID of the recording
            stream_url: WebRTC stream URL or RTMP URL
            output_path: Optional custom output path
        
        Returns:
            subprocess.Popen object or None
        """
        try:
            recording = Recording.objects.get(id=recording_id)
            
            if not output_path:
                output_path = os.path.join(
                    self.storage_path,
                    str(recording.room.id),
                    f"{recording_id}.{self.format}"
                )
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # FFmpeg command for recording
            # This is a basic example - actual WebRTC recording is more complex
            cmd = [
                self.ffmpeg_path,
                '-y',  # Overwrite output file
                '-i', stream_url,  # Input stream
                '-c:v', 'libvpx-vp9',  # VP9 codec for WebM
                '-c:a', 'libopus',  # Opus codec for audio
                '-b:v', '2M',  # Video bitrate
                '-b:a', '128k',  # Audio bitrate
                '-t', str(self.max_duration),  # Max duration
                '-f', self.format,  # Output format
                output_path
            ]
            
            # Start FFmpeg process
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            logger.info(f"Recording started: {recording_id} -> {output_path}")
            
            return process
            
        except Recording.DoesNotExist:
            logger.error(f"Recording not found: {recording_id}")
            return None
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            return None
    
    def stop_recording(self, process):
        """Stop recording process gracefully"""
        try:
            if process and process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
                logger.info("Recording stopped successfully")
                return True
        except subprocess.TimeoutExpired:
            process.kill()
            logger.warning("Recording process killed (timeout)")
            return True
        except Exception as e:
            logger.error(f"Failed to stop recording: {e}")
            return False
    
    def get_recording_info(self, file_path):
        """Get recording file information using FFprobe"""
        try:
            cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                file_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                import json
                return json.loads(result.stdout)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get recording info: {e}")
            return None
    
    def convert_recording(self, input_path, output_path, format='mp4'):
        """Convert recording to different format"""
        try:
            cmd = [
                self.ffmpeg_path,
                '-i', input_path,
                '-c:v', 'libx264',  # H.264 for MP4
                '-c:a', 'aac',  # AAC for audio
                '-movflags', '+faststart',  # Enable streaming
                output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"Recording converted: {input_path} -> {output_path}")
                return True
            else:
                logger.error(f"Conversion failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to convert recording: {e}")
            return False
    
    def generate_thumbnail(self, video_path, thumbnail_path, time='00:00:01'):
        """Generate thumbnail from video"""
        try:
            cmd = [
                self.ffmpeg_path,
                '-i', video_path,
                '-ss', time,
                '-vframes', '1',
                '-vf', 'scale=320:-1',
                thumbnail_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"Thumbnail generated: {thumbnail_path}")
                return True
            else:
                logger.error(f"Thumbnail generation failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to generate thumbnail: {e}")
            return False


# Singleton instance
recording_service = RecordingService()
