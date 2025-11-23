# apps/authentication/sso_views.py - SSO OAuth and SAML views
from django.conf import settings
from django.shortcuts import redirect
from django.http import JsonResponse, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import logging
import urllib.parse
import requests
from .models import User
from .sso_backends import OAuth2Backend, SAMLBackend

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_initiate(request, provider):
    """
    Initiate OAuth flow for a provider (google, microsoft, etc.)
    """
    if not settings.ENABLE_OAUTH:
        return JsonResponse({'error': 'OAuth is not enabled'}, status=403)
    
    provider = provider.lower()
    
    if provider == 'google':
        # Google OAuth 2.0
        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            return JsonResponse({'error': 'Google OAuth not configured'}, status=500)
        
        # Build authorization URL
        params = {
            'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
            'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
            'response_type': 'code',
            'scope': 'openid email profile',
            'access_type': 'online',
            'prompt': 'consent',
        }
        
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
        
        # Store state in session for CSRF protection
        request.session['oauth_state'] = 'google_oauth_state'
        request.session['oauth_provider'] = 'google'
        
        return redirect(auth_url)
    
    elif provider == 'microsoft':
        # Microsoft OAuth 2.0
        if not settings.MICROSOFT_OAUTH_CLIENT_ID:
            return JsonResponse({'error': 'Microsoft OAuth not configured'}, status=500)
        
        # Build authorization URL
        params = {
            'client_id': settings.MICROSOFT_OAUTH_CLIENT_ID,
            'redirect_uri': settings.MICROSOFT_OAUTH_REDIRECT_URI,
            'response_type': 'code',
            'scope': 'openid email profile User.Read',
            'response_mode': 'query',
        }
        
        auth_url = f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{urllib.parse.urlencode(params)}"
        
        # Store state in session
        request.session['oauth_state'] = 'microsoft_oauth_state'
        request.session['oauth_provider'] = 'microsoft'
        
        return redirect(auth_url)
    
    else:
        return JsonResponse({'error': f'Unsupported OAuth provider: {provider}'}, status=400)


@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_callback(request, provider):
    """
    Handle OAuth callback from provider
    """
    if not settings.ENABLE_OAUTH:
        return JsonResponse({'error': 'OAuth is not enabled'}, status=403)
    
    provider = provider.lower()
    code = request.GET.get('code')
    error = request.GET.get('error')
    
    if error:
        logger.error(f"OAuth error from {provider}: {error}")
        return JsonResponse({'error': f'OAuth error: {error}'}, status=400)
    
    if not code:
        return JsonResponse({'error': 'No authorization code provided'}, status=400)
    
    # Verify state (CSRF protection)
    if request.session.get('oauth_provider') != provider:
        return JsonResponse({'error': 'Invalid OAuth state'}, status=400)
    
    try:
        if provider == 'google':
            # Exchange code for access token
            token_data = {
                'code': code,
                'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
                'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
                'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
                'grant_type': 'authorization_code',
            }
            
            token_response = requests.post(
                'https://oauth2.googleapis.com/token',
                data=token_data
            )
            
            if token_response.status_code != 200:
                logger.error(f"Google token exchange failed: {token_response.text}")
                return JsonResponse({'error': 'Token exchange failed'}, status=500)
            
            token_json = token_response.json()
            access_token = token_json.get('access_token')
            
            # Get user info
            user_info_response = requests.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                headers={'Authorization': f'Bearer {access_token}'}
            )
            
            if user_info_response.status_code != 200:
                logger.error(f"Google user info failed: {user_info_response.text}")
                return JsonResponse({'error': 'Failed to get user info'}, status=500)
            
            user_info = user_info_response.json()
            email = user_info.get('email')
            name = user_info.get('name', '')
            
        elif provider == 'microsoft':
            # Exchange code for access token
            token_data = {
                'code': code,
                'client_id': settings.MICROSOFT_OAUTH_CLIENT_ID,
                'client_secret': settings.MICROSOFT_OAUTH_CLIENT_SECRET,
                'redirect_uri': settings.MICROSOFT_OAUTH_REDIRECT_URI,
                'grant_type': 'authorization_code',
            }
            
            token_response = requests.post(
                'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                data=token_data
            )
            
            if token_response.status_code != 200:
                logger.error(f"Microsoft token exchange failed: {token_response.text}")
                return JsonResponse({'error': 'Token exchange failed'}, status=500)
            
            token_json = token_response.json()
            access_token = token_json.get('access_token')
            
            # Get user info
            user_info_response = requests.get(
                'https://graph.microsoft.com/v1.0/me',
                headers={'Authorization': f'Bearer {access_token}'}
            )
            
            if user_info_response.status_code != 200:
                logger.error(f"Microsoft user info failed: {user_info_response.text}")
                return JsonResponse({'error': 'Failed to get user info'}, status=500)
            
            user_info = user_info_response.json()
            email = user_info.get('mail') or user_info.get('userPrincipalName')
            name = user_info.get('displayName', '')
        
        else:
            return JsonResponse({'error': f'Unsupported provider: {provider}'}, status=400)
        
        if not email:
            return JsonResponse({'error': 'Email not provided by OAuth provider'}, status=400)
        
        # Get or create user
        user, created = User.objects.get_or_create(
            email=email.lower(),
            defaults={
                'first_name': name.split()[0] if name else '',
                'last_name': ' '.join(name.split()[1:]) if len(name.split()) > 1 else '',
                'role': 'user',
            }
        )
        
        if created:
            user.set_unusable_password()  # OAuth users don't need passwords
            user.save()
            logger.info(f"Created new user via OAuth: {email}")
        else:
            logger.info(f"Existing user logged in via OAuth: {email}")
        
        # Authenticate user
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        
        # Clear OAuth session data
        request.session.pop('oauth_state', None)
        request.session.pop('oauth_provider', None)
        
        # Return tokens (or redirect to frontend with tokens)
        return JsonResponse({
            'message': 'OAuth authentication successful',
            'user': {
                'id': str(user.id),
                'email': user.email,
                'name': user.get_full_name(),
                'role': user.role,
            },
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        })
        
    except Exception as e:
        logger.error(f"OAuth callback error: {e}", exc_info=True)
        return JsonResponse({'error': 'OAuth authentication failed'}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def saml_initiate(request):
    """
    Initiate SAML authentication flow
    """
    if not settings.ENABLE_SAML:
        return JsonResponse({'error': 'SAML is not enabled'}, status=403)
    
    try:
        from onelogin.saml2.auth import OneLogin_Saml2_Auth
        from onelogin.saml2.utils import OneLogin_Saml2_Utils
        
        # Prepare request for SAML
        saml_request = prepare_saml_request(request)
        
        # Create SAML auth object
        saml_auth = OneLogin_Saml2_Auth(saml_request, get_saml_settings())
        
        # Build SSO URL
        sso_url = saml_auth.login()
        
        # Store SAML request ID for validation
        request.session['saml_request_id'] = saml_auth.get_last_request_id()
        
        return redirect(sso_url)
        
    except ImportError:
        logger.warning("SAML libraries not installed")
        return JsonResponse({'error': 'SAML libraries not installed'}, status=500)
    except Exception as e:
        logger.error(f"SAML initiate error: {e}", exc_info=True)
        return JsonResponse({'error': 'SAML authentication failed'}, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def saml_acs(request):
    """
    Handle SAML Assertion Consumer Service (ACS) - receives SAML response
    """
    if not settings.ENABLE_SAML:
        return JsonResponse({'error': 'SAML is not enabled'}, status=403)
    
    try:
        from onelogin.saml2.auth import OneLogin_Saml2_Auth
        
        # Prepare request for SAML
        saml_request = prepare_saml_request(request)
        
        # Create SAML auth object
        saml_auth = OneLogin_Saml2_Auth(saml_request, get_saml_settings())
        
        # Process SAML response
        saml_auth.process_response(request.session.get('saml_request_id'))
        
        if saml_auth.is_authenticated():
            # Get user attributes
            attributes = saml_auth.get_attributes()
            email = attributes.get('email', [None])[0] or attributes.get('mail', [None])[0]
            name = attributes.get('name', [None])[0] or attributes.get('displayName', [None])[0]
            
            if not email:
                return JsonResponse({'error': 'Email not provided in SAML assertion'}, status=400)
            
            # Get or create user
            user, created = User.objects.get_or_create(
                email=email.lower(),
                defaults={
                    'first_name': name.split()[0] if name else '',
                    'last_name': ' '.join(name.split()[1:]) if len(name.split()) > 1 else '',
                    'role': 'user',
                }
            )
            
            if created:
                user.set_unusable_password()
                user.save()
                logger.info(f"Created new user via SAML: {email}")
            else:
                logger.info(f"Existing user logged in via SAML: {email}")
            
            # Generate JWT tokens
            from rest_framework_simplejwt.tokens import RefreshToken
            refresh = RefreshToken.for_user(user)
            
            # Clear SAML session data
            request.session.pop('saml_request_id', None)
            
            return JsonResponse({
                'message': 'SAML authentication successful',
                'user': {
                    'id': str(user.id),
                    'email': user.email,
                    'name': user.get_full_name(),
                    'role': user.role,
                },
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            })
        else:
            errors = saml_auth.get_errors()
            logger.error(f"SAML authentication failed: {errors}")
            return JsonResponse({'error': 'SAML authentication failed', 'errors': errors}, status=400)
            
    except ImportError:
        logger.warning("SAML libraries not installed")
        return JsonResponse({'error': 'SAML libraries not installed'}, status=500)
    except Exception as e:
        logger.error(f"SAML ACS error: {e}", exc_info=True)
        return JsonResponse({'error': 'SAML authentication failed'}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def saml_metadata(request):
    """
    Return SAML Service Provider metadata
    """
    if not settings.ENABLE_SAML:
        return JsonResponse({'error': 'SAML is not enabled'}, status=403)
    
    try:
        from onelogin.saml2.settings import OneLogin_Saml2_Settings
        from onelogin.saml2.metadata import OneLogin_Saml2_Metadata
        
        saml_settings = get_saml_settings()
        settings_obj = OneLogin_Saml2_Settings(settings=saml_settings, sp_validation_only=True)
        metadata = OneLogin_Saml2_Metadata.builder(settings_obj)
        
        return HttpResponse(metadata, content_type='text/xml')
        
    except ImportError:
        logger.warning("SAML libraries not installed")
        return JsonResponse({'error': 'SAML libraries not installed'}, status=500)
    except Exception as e:
        logger.error(f"SAML metadata error: {e}", exc_info=True)
        return JsonResponse({'error': 'Failed to generate SAML metadata'}, status=500)


def prepare_saml_request(request):
    """Prepare request dict for SAML library"""
    return {
        'https': 'on' if request.is_secure() else 'off',
        'http_host': request.get_host(),
        'script_name': request.path,
        'get_data': request.GET.copy(),
        'post_data': request.POST.copy(),
    }


def get_saml_settings():
    """Get SAML settings dict"""
    return {
        'sp': {
            'entityId': settings.SAML_SP_ENTITY_ID,
            'assertionConsumerService': {
                'url': settings.SAML_SP_ACS_URL,
                'binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
            },
        },
        'idp': {
            'entityId': settings.SAML_IDP_ENTITY_ID,
            'singleSignOnService': {
                'url': settings.SAML_IDP_SSO_URL,
                'binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect'
            },
            'x509cert': settings.SAML_IDP_CERT,
        },
    }

