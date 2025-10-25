from django.contrib import admin
from .models import RoomAnalytics, SystemMetrics, UserActivityLog

# Note: Room and RoomParticipant are managed via Redis (RoomManager), not Django models
# Chat models (ChatMessage, ChatAttachment, ScreenShareSession) reference non-existent Room/RoomParticipant
# and have been temporarily disabled until the data model is refactored


@admin.register(RoomAnalytics)
class RoomAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['period', 'period_start', 'total_rooms_created', 'total_participants', 
                    'avg_participants_per_room', 'sfu_rooms_created', 'success_rate']
    list_filter = ['period', 'period_start']
    readonly_fields = ['period', 'period_start', 'period_end', 'created_at', 'success_rate']
    
    def success_rate(self, obj):
        return f"{obj.success_rate:.2f}%"
    success_rate.short_description = 'SFU Success Rate'


@admin.register(SystemMetrics)
class SystemMetricsAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'cpu_usage', 'memory_usage', 'active_rooms', 
                    'total_participants', 'websocket_connections', 'response_time_avg']
    list_filter = ['timestamp']
    readonly_fields = ['timestamp', 'cpu_usage', 'memory_usage', 'disk_usage', 
                      'network_in', 'network_out', 'active_connections']
    
    def has_add_permission(self, request):
        return False  # Metrics should be created programmatically


@admin.register(UserActivityLog)
class UserActivityLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'user_email', 'action', 'severity', 'ip_address']
    list_filter = ['action', 'severity', 'timestamp']
    search_fields = ['user_email', 'ip_address', 'description']
    readonly_fields = ['timestamp', 'user', 'user_email', 'action', 'severity', 
                      'ip_address', 'user_agent', 'session_key', 'metadata']
    
    def has_add_permission(self, request):
        return False  # Logs should be created programmatically
