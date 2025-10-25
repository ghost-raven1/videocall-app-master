# apps/rooms/chat_models.py - Chat and file attachment models
import os
import uuid
from django.db import models
from django.core.validators import FileExtensionValidator
from django.utils import timezone


def chat_file_upload_path(instance, filename):
    """Generate upload path for chat attachments"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('chat_files', str(instance.room_id), filename)


class ChatMessage(models.Model):
    """Chat message in a room"""
    
    MESSAGE_TYPES = (
        ('text', 'Text'),
        ('file', 'File'),
        ('system', 'System'),
        ('notification', 'Notification'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_id = models.CharField(max_length=255, db_index=True)  # Store room ID as string
    sender_id = models.CharField(max_length=255)  # Store sender ID as string
    content = models.TextField()
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_pinned = models.BooleanField(default=False)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['room_id', 'created_at']),
        ]

    def __str__(self):
        return f"Message {self.id} in room {self.room_id}"

    def to_dict(self):
        """Convert message to dictionary for API/WebSocket"""
        return {
            'id': str(self.id),
            'room_id': self.room_id,
            'sender_id': self.sender_id,
            'content': self.content,
            'message_type': self.message_type,
            'created_at': self.created_at.isoformat(),
            'is_pinned': self.is_pinned,
            'is_edited': self.is_edited,
            'is_deleted': self.is_deleted,
            'metadata': self.metadata,
            'attachments': [a.to_dict() for a in self.attachments.all()],
            'reply_to': self.reply_to.to_dict() if self.reply_to else None,
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
    room_id = models.CharField(max_length=255, db_index=True)  # Store room ID as string
    file = models.FileField(
        upload_to=chat_file_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=ALLOWED_EXTENSIONS)]
    )
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=FILE_TYPES, default='other')
    file_size = models.BigIntegerField()
    mime_type = models.CharField(max_length=100)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.CharField(max_length=255, null=True)  # Store user ID as string
    download_count = models.IntegerField(default=0)

    def __str__(self):
        return f"Attachment {self.original_filename} for message {self.message_id}"

    def get_file_type_from_extension(self):
        """Determine file type from extension"""
        ext = self.original_filename.split('.')[-1].lower()
        if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']:
            return 'image'
        elif ext in ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']:
            return 'document'
        elif ext in ['zip', 'rar', '7z', 'tar', 'gz']:
            return 'archive'
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
            'message_id': str(self.message_id),
            'room_id': self.room_id,
            'file_url': self.file.url if self.file else None,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'uploaded_at': self.uploaded_at.isoformat(),
            'uploaded_by': self.uploaded_by,
            'download_count': self.download_count,
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
    room_id = models.CharField(max_length=255, db_index=True)  # Store room ID as string
    participant_id = models.CharField(max_length=255)  # Store participant ID as string
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    stream_id = models.CharField(max_length=255)
    started_at = models.DateTimeField(auto_now_add=True)
    stopped_at = models.DateTimeField(null=True, blank=True)
    total_duration = models.IntegerField(default=0)  # in seconds
    viewer_count = models.IntegerField(default=0)

    def __str__(self):
        return f"Screen share {self.stream_id} in room {self.room_id}"

    def stop(self):
        """Stop screen sharing session"""
        self.status = 'stopped'
        self.stopped_at = timezone.now()
        self.total_duration = (self.stopped_at - self.started_at).seconds
        self.save()

    def to_dict(self):
        """Convert to dictionary for API/WebSocket"""
        return {
            'id': str(self.id),
            'room_id': self.room_id,
            'participant_id': self.participant_id,
            'status': self.status,
            'stream_id': self.stream_id,
            'started_at': self.started_at.isoformat(),
            'stopped_at': self.stopped_at.isoformat() if self.stopped_at else None,
            'total_duration': self.total_duration,
            'viewer_count': self.viewer_count,
        }
