# authentication/urls.py - Authentication URL patterns
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from .views import CookieTokenObtainPairView, CookieTokenRefreshView
from . import sso_views

app_name = 'authentication'

# Create router for ViewSets
router = DefaultRouter()
router.register(r'users', views.UserManagementViewSet, basename='users')
router.register(r'activity', views.UserActivityViewSet, basename='activity')

# Admin panel aliases (for Vue.js admin)
admin_router = DefaultRouter()
admin_router.register(r'admin/users', views.UserManagementViewSet, basename='admin_users')

urlpatterns = [
    # Legacy authentication endpoints (for backward compatibility)
    path('login/', views.login_view, name='login'),
    path('legacy/logout/', views.logout_view, name='logout_legacy'),
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

    # SSO OAuth endpoints
    path('oauth/<str:provider>/initiate/', sso_views.oauth_initiate, name='oauth_initiate'),
    path('oauth/<str:provider>/callback/', sso_views.oauth_callback, name='oauth_callback'),

    # SSO SAML endpoints
    path('saml/initiate/', sso_views.saml_initiate, name='saml_initiate'),
    path('saml/acs/', sso_views.saml_acs, name='saml_acs'),
    path('saml/metadata/', sso_views.saml_metadata, name='saml_metadata'),

    # Include router URLs
    path('', include(router.urls)),
    
    # Admin panel aliases (for Vue.js admin)
    path('', include(admin_router.urls)),
]
