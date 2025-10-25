# apps/rooms/recording_models.py - Recording models for enterprise features
import os
import uuid
from django.db import models
from django.core.validators import FileExtensionValidator
from django.utils import timezone
from .models import Room, RoomParticipant


def recording_upload_path(instance, filename):
    """Generate upload path for recordings"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('recordings', str(instance.room.id), filename)


class Recording(models.Model):
    """Video call recording"""
    
    STATUS_CHOICES = (
        ('recording', 'Recording'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='recordings')
    
    # Recording metadata
    started_by = models.ForeignKey(
        RoomParticipant,
        on_delete=models.SET_NULL,
        null=True,
        related_name='started_recordings'
    )
    started_at = models.DateTimeField(auto_now_add=True)
    stopped_at = models.DateTimeField(null=True, blank=True)
    
    # File information
    file = models.FileField(
        upload_to=recording_upload_path,
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=['webm', 'mp4', 'mkv'])]
    )
    file_size = models.BigIntegerField(default=0)  # in bytes
    duration = models.IntegerField(default=0)  # in seconds
    
    # Status and processing
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='recording')
    error_message = models.TextField(blank=True)
    
    # Settings
    include_audio = models.BooleanField(default=True)
    include_video = models.BooleanField(default=True)
    include_screen_share = models.BooleanField(default=True)
    
    # Access control
    is_public = models.BooleanField(default=False)
    password = models.CharField(max_length=255, blank=True)
    
    # Statistics
    view_count = models.IntegerField(default=0)
    download_count = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['room', 'started_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Recording of {self.room.code} at {self.started_at}"
    
    @property
    def is_active(self):
        """Check if recording is currently active"""
        return self.status == 'recording'
    
    @property
    def formatted_duration(self):
        """Get formatted duration"""
        if self.duration == 0:
            return "00:00"
        hours = self.duration // 3600
        minutes = (self.duration % 3600) // 60
        seconds = self.duration % 60
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        return f"{minutes:02d}:{seconds:02d}"
    
    @property
    def file_size_mb(self):
        """Get file size in MB"""
        return round(self.file_size / (1024 * 1024), 2)
    
    def stop(self):
        """Stop recording"""
        if self.status == 'recording':
            self.stopped_at = timezone.now()
            self.status = 'processing'
            if self.started_at:
                duration = (self.stopped_at - self.started_at).total_seconds()
                self.duration = int(duration)
            self.save()
    
    def mark_completed(self, file_size=0):
        """Mark recording as completed"""
        self.status = 'completed'
        self.file_size = file_size
        self.save()
    
    def mark_failed(self, error_message):
        """Mark recording as failed"""
        self.status = 'failed'
        self.error_message = error_message
        self.save()
    
    def increment_view_count(self):
        """Increment view counter"""
        self.view_count += 1
        self.save(update_fields=['view_count'])
    
    def increment_download_count(self):
        """Increment download counter"""
        self.download_count += 1
        self.save(update_fields=['download_count'])
    
    def to_dict(self):
        """Convert to dictionary for API"""
        return {
            'id': str(self.id),
            'room_code': self.room.code,
            'started_at': self.started_at.isoformat(),
            'stopped_at': self.stopped_at.isoformat() if self.stopped_at else None,
            'duration': self.duration,
            'formatted_duration': self.formatted_duration,
            'file_size': self.file_size,
            'file_size_mb': self.file_size_mb,
            'status': self.status,
            'is_active': self.is_active,
            'view_count': self.view_count,
            'download_count': self.download_count,
            'url': self.file.url if self.file else None,
        }
