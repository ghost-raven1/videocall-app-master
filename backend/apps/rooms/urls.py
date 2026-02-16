# rooms/urls.py - Room management URL patterns
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import chat_views
from . import recording_views

app_name = 'rooms'

# Create router for ViewSets
router = DefaultRouter()
router.register(r'admin/management', views.RoomManagementViewSet, basename='room_management')
router.register(r'admin/analytics', views.RoomAnalyticsViewSet, basename='room_analytics')

# Admin panel aliases (for Vue.js admin)
admin_router = DefaultRouter()
admin_router.register(r'admin/rooms', views.RoomManagementViewSet, basename='admin_rooms')
admin_router.register(r'admin/analytics', views.RoomAnalyticsViewSet, basename='admin_analytics')

# Chat and screen share routers
router.register(r'chat/messages', chat_views.ChatMessageViewSet, basename='chat_messages')
router.register(r'chat/attachments', chat_views.ChatAttachmentViewSet, basename='chat_attachments')
router.register(r'screen-share', chat_views.ScreenShareViewSet, basename='screen_share')

# Recording router (Enterprise feature)
router.register(r'recordings', recording_views.RecordingViewSet, basename='recordings')

urlpatterns = [
    # Legacy room endpoints (for backward compatibility)
    path('create/', views.create_room, name='create'),
    path('join/', views.join_room, name='join'),

    # Admin-only endpoints
    path('admin/force-close/<str:room_id>/', views.force_close_room, name='force_close_room'),
    path('admin/health/', views.system_health, name='system_health'),
    path('admin/search/', views.room_search, name='room_search'),

    # Analytics endpoints for dashboard
    path('admin/analytics/dashboard/', views.RoomAnalyticsViewSet.as_view({'get': 'dashboard_stats'}), name='dashboard_stats'),
    path('admin/dashboard/stats', views.RoomAnalyticsViewSet.as_view({'get': 'dashboard_stats'}), name='admin_dashboard_stats'),  # Alias for Vue.js admin
    path('admin/rooms/active/', views.RoomManagementViewSet.as_view({'get': 'active_rooms'}), name='active_rooms'),
    path('admin/activity/logs/', views.RoomManagementViewSet.as_view({'get': 'room_activity_logs'}), name='room_activity_logs'),

    # SFU server endpoint without room_id
    path('sfu/server/stats/', views.get_sfu_server_stats, name='get_sfu_server_stats'),

    # Room-id endpoints (must be below fixed prefixes like admin/* and sfu/*)
    path('<str:room_id>/', views.get_room, name='get'),
    path('<str:room_id>/leave/', views.leave_room, name='leave'),
    path('<str:room_id>/delete/', views.delete_room, name='delete'),
    path('<str:room_id>/sfu/create/', views.create_sfu_room, name='create_sfu_room'),
    path('<str:room_id>/sfu/info/', views.get_room_sfu_info, name='get_room_sfu_info'),
    path('<str:room_id>/statistics/', views.get_room_statistics, name='get_room_statistics'),
    path('<str:room_id>/health/', views.check_room_health, name='check_room_health'),

    # Include router URLs
    path('', include(router.urls)),
    
    # Admin panel aliases (for Vue.js admin)
    path('', include(admin_router.urls)),
]
