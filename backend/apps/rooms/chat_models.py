# apps/rooms/chat_models.py - Chat and file attachment models
import os
import uuid
from django.db import models
from django.core.validators import FileExtensionValidator
from django.utils import timezone
from .models import Room, RoomParticipant


def chat_file_upload_path(instance, filename):
    """Generate upload path for chat attachments"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('chat_files', str(instance.room.id), filename)


class ChatMessage(models.Model):
    """Chat message in a room"""
    
    MESSAGE_TYPES = (
        ('text', 'Text Message'),
        ('file', 'File Attachment'),
        ('system', 'System Message'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='chat_messages')
    participant = models.ForeignKey(
        RoomParticipant, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='messages'
    )
    
    # Message content
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    content = models.TextField(blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    
    # Reply functionality
    reply_to = models.ForeignKey(
        'self', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='replies'
    )
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['room', 'created_at']),
            models.Index(fields=['participant', 'created_at']),
        ]
    
    def __str__(self):
        return f"Message in {self.room.code} by {self.participant.display_name if self.participant else 'System'}"
    
    def to_dict(self):
        """Convert message to dictionary for API/WebSocket"""
        return {
            'id': str(self.id),
            'room_id': str(self.room.id),
            'participant': {
                'id': str(self.participant.id) if self.participant else None,
                'display_name': self.participant.display_name if self.participant else 'System',
                'user_id': self.participant.user_id if self.participant else None,
            } if self.participant else None,
            'message_type': self.message_type,
            'content': self.content if not self.is_deleted else '[Deleted]',
            'created_at': self.created_at.isoformat(),
            'edited_at': self.edited_at.isoformat() if self.edited_at else None,
            'is_deleted': self.is_deleted,
            'reply_to': str(self.reply_to.id) if self.reply_to else None,
            'attachments': [att.to_dict() for att in self.attachments.all()],
        }


class ChatAttachment(models.Model):
    """File attachment for chat messages"""
    
    ALLOWED_EXTENSIONS = [
        # Images
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
        # Documents
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
        # Archives
        'zip', 'rar', '7z', 'tar', 'gz',
        # Other
        'csv', 'json', 'xml',
    ]
    
    FILE_TYPES = (
        ('image', 'Image'),
        ('document', 'Document'),
        ('archive', 'Archive'),
        ('other', 'Other'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='attachments')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='chat_attachments')
    
    # File information
    file = models.FileField(
        upload_to=chat_file_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=ALLOWED_EXTENSIONS)]
    )
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=FILE_TYPES, default='other')
    file_size = models.BigIntegerField()  # in bytes
    mime_type = models.CharField(max_length=100)
    
    # Metadata
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        RoomParticipant,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_files'
    )
    
    # Download tracking
    download_count = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['uploaded_at']
        indexes = [
            models.Index(fields=['room', 'uploaded_at']),
            models.Index(fields=['message']),
        ]
    
    def __str__(self):
        return f"{self.original_filename} in {self.room.code}"
    
    def get_file_type_from_extension(self):
        """Determine file type from extension"""
        ext = self.original_filename.split('.')[-1].lower()
        
        if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']:
            return 'image'
        elif ext in ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']:
            return 'document'
        elif ext in ['zip', 'rar', '7z', 'tar', 'gz']:
            return 'archive'
        else:
            return 'other'
    
    def save(self, *args, **kwargs):
        """Auto-detect file type on save"""
        if not self.file_type or self.file_type == 'other':
            self.file_type = self.get_file_type_from_extension()
        super().save(*args, **kwargs)
    
    def to_dict(self):
        """Convert attachment to dictionary for API/WebSocket"""
        return {
            'id': str(self.id),
            'message_id': str(self.message.id),
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'uploaded_at': self.uploaded_at.isoformat(),
            'uploaded_by': self.uploaded_by.display_name if self.uploaded_by else 'Unknown',
            'download_count': self.download_count,
            'url': self.file.url if self.file else None,
        }
    
    def increment_download_count(self):
        """Increment download counter"""
        self.download_count += 1
        self.save(update_fields=['download_count'])


class ScreenShareSession(models.Model):
    """Track screen sharing sessions in rooms"""
    
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('stopped', 'Stopped'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='screen_shares')
    participant = models.ForeignKey(
        RoomParticipant,
        on_delete=models.CASCADE,
        related_name='screen_shares'
    )
    
    # Session info
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    stream_id = models.CharField(max_length=255)  # WebRTC stream ID
    
    # Timestamps
    started_at = models.DateTimeField(auto_now_add=True)
    stopped_at = models.DateTimeField(null=True, blank=True)
    
    # Statistics
    total_duration = models.IntegerField(default=0)  # in seconds
    viewer_count = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['room', 'status']),
            models.Index(fields=['participant', 'status']),
        ]
    
    def __str__(self):
        return f"Screen share by {self.participant.display_name} in {self.room.code}"
    
    def stop(self):
        """Stop screen sharing session"""
        if self.status != 'stopped':
            self.status = 'stopped'
            self.stopped_at = timezone.now()
            if self.started_at:
                duration = (self.stopped_at - self.started_at).total_seconds()
                self.total_duration = int(duration)
            self.save()
    
    def to_dict(self):
        """Convert to dictionary for API/WebSocket"""
        return {
            'id': str(self.id),
            'room_id': str(self.room.id),
            'participant': {
                'id': str(self.participant.id),
                'display_name': self.participant.display_name,
                'user_id': self.participant.user_id,
            },
            'status': self.status,
            'stream_id': self.stream_id,
            'started_at': self.started_at.isoformat(),
            'stopped_at': self.stopped_at.isoformat() if self.stopped_at else None,
            'total_duration': self.total_duration,
            'viewer_count': self.viewer_count,
        }
