# authentication/urls.py - Authentication URL patterns
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from .views import CookieTokenObtainPairView, CookieTokenRefreshView

app_name = 'authentication'

# Create router for ViewSets
router = DefaultRouter()
router.register(r'users', views.UserManagementViewSet, basename='users')
router.register(r'activity', views.UserActivityViewSet, basename='activity')

urlpatterns = [
    # Legacy authentication endpoints (for backward compatibility)
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('check/', views.check_auth_view, name='check'),

    # JWT Authentication endpoints
    path('jwt/login/', views.AdminLoginView.as_view(), name='jwt_login'),
    path('jwt/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Secure JWT with httpOnly cookies
    path('token/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh_cookie'),
    path('logout/', views.cookie_logout_view, name='logout_cookie'),

    # User management endpoints
    path('admin/users/suspend/<uuid:pk>/', views.UserManagementViewSet.as_view({'post': 'suspend'}), name='user_suspend'),
    path('admin/users/reactivate/<uuid:pk>/', views.UserManagementViewSet.as_view({'post': 'reactivate'}), name='user_reactivate'),

    # Statistics endpoints
    path('stats/', views.user_stats, name='user_stats'),
    path('session/info/', views.session_info, name='session_info'),

    # Activity endpoints
    path('activity/recent/', views.UserActivityViewSet.as_view({'get': 'recent'}), name='recent_activity'),

    # Include router URLs
    path('', include(router.urls)),
]
