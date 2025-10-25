from django.contrib import admin
from .models import Room, RoomParticipant
from .chat_models import ChatMessage, ChatAttachment, ScreenShareSession


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'created_by', 'is_active', 'created_at', 'participant_count']
    list_filter = ['is_active', 'created_at']
    search_fields = ['code', 'name', 'created_by']
    readonly_fields = ['code', 'created_at', 'updated_at']
    
    def participant_count(self, obj):
        return obj.participants.filter(status='active').count()
    participant_count.short_description = 'Active Participants'


@admin.register(RoomParticipant)
class RoomParticipantAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'room', 'status', 'joined_at', 'is_host']
    list_filter = ['status', 'is_host', 'joined_at']
    search_fields = ['display_name', 'room__code', 'user_id']
    readonly_fields = ['joined_at', 'left_at']


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'room', 'participant_name', 'message_type', 'content_preview', 'created_at', 'is_deleted']
    list_filter = ['message_type', 'is_deleted', 'created_at']
    search_fields = ['content', 'room__code', 'participant__display_name']
    readonly_fields = ['id', 'created_at', 'edited_at']
    
    def participant_name(self, obj):
        return obj.participant.display_name if obj.participant else 'System'
    participant_name.short_description = 'Participant'
    
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'


@admin.register(ChatAttachment)
class ChatAttachmentAdmin(admin.ModelAdmin):
    list_display = ['original_filename', 'file_type', 'file_size_mb', 'room', 'uploaded_by_name', 'uploaded_at', 'download_count']
    list_filter = ['file_type', 'uploaded_at']
    search_fields = ['original_filename', 'room__code']
    readonly_fields = ['id', 'uploaded_at', 'download_count']
    
    def uploaded_by_name(self, obj):
        return obj.uploaded_by.display_name if obj.uploaded_by else 'Unknown'
    uploaded_by_name.short_description = 'Uploaded By'
    
    def file_size_mb(self, obj):
        return f"{obj.file_size / (1024 * 1024):.2f} MB"
    file_size_mb.short_description = 'Size'


@admin.register(ScreenShareSession)
class ScreenShareSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'room', 'participant_name', 'status', 'started_at', 'duration_minutes', 'viewer_count']
    list_filter = ['status', 'started_at']
    search_fields = ['room__code', 'participant__display_name']
    readonly_fields = ['id', 'started_at', 'stopped_at', 'total_duration']
    
    def participant_name(self, obj):
        return obj.participant.display_name
    participant_name.short_description = 'Participant'
    
    def duration_minutes(self, obj):
        if obj.total_duration:
            return f"{obj.total_duration // 60} min"
        return "Active"
    duration_minutes.short_description = 'Duration'
