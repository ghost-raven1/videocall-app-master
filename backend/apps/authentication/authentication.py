from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import exceptions
from django.conf import settings

class CookieJWTAuthentication(JWTAuthentication):
    """
    JWT authentication that reads tokens from httpOnly cookies
    """
    def authenticate(self, request):
        # Get the token from the cookie
        token = request.COOKIES.get(settings.JWT_COOKIE_SETTINGS['ACCESS_TOKEN_COOKIE_NAME'])
        
        if not token:
            return None
            
        # Validate the token
        try:
            validated_token = self.get_validated_token(token)
            user = self.get_user(validated_token)
            return (user, validated_token)
        except exceptions.AuthenticationFailed:
            # Re-raise authentication errors
            raise
        except Exception as e:
            # Log unexpected errors but don't expose details to client
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Unexpected authentication error: {e}", exc_info=True)
            raise exceptions.AuthenticationFailed('Authentication failed')
