# videocall_app/urls.py - Main URL configuration
# Django Admin отключен - используется админка приложения (Vue.js)
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    # path('admin/', admin.site.urls),  # Отключено - используем админку приложения
    path('api/auth/', include('apps.authentication.urls')),
    path('api/rooms/', include('apps.rooms.urls')),
    path('api/', include('apps.core.urls')),
    
    # OpenAPI documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
