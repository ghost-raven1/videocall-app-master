# authentication/models.py - User authentication and role management models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
import uuid


class UserManager(BaseUserManager):
    """Custom manager for User model with role support"""

    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user"""
        if not email:
            raise ValueError('The Email field must be set')

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

    def get_by_role(self, role):
        """Get users by role"""
        return self.filter(role=role, is_active=True)

    def admins(self):
        """Get all admin users"""
        return self.get_by_role('admin')

    def moderators(self):
        """Get all moderator users"""
        return self.get_by_role('moderator')


class User(AbstractUser):
    """Custom user model with role-based access control"""

    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('moderator', 'Moderator'),
        ('user', 'Regular User'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    is_active = models.BooleanField(default=True)
    last_activity = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Remove username field since we're using email
    username = None

    # Fix conflicts with Django's built-in User model
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='authentication_users',
        blank=True,
        help_text='The groups this user belongs to.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='authentication_users',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'role']),
            models.Index(fields=['role', 'is_active']),
            models.Index(fields=['last_activity']),
        ]

    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"

    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = timezone.now()
        self.save(update_fields=['last_activity'])

    def has_permission(self, permission):
        """Check if user has specific permission based on role"""
        role_permissions = {
            'admin': [
                'manage_users', 'manage_rooms', 'view_analytics',
                'system_settings', 'force_close_rooms', 'delete_users'
            ],
            'moderator': [
                'manage_rooms', 'view_analytics', 'force_close_rooms'
            ],
            'user': []
        }
        return permission in role_permissions.get(self.role, [])

    def is_admin(self):
        """Check if user is admin"""
        return self.role == 'admin' and self.is_active

    def is_moderator(self):
        """Check if user is moderator or admin"""
        return self.role in ['admin', 'moderator'] and self.is_active

    def can_manage_user(self, target_user):
        """Check if user can manage another user"""
        if not self.is_active:
            return False

        if self.role == 'admin':
            return True

        if self.role == 'moderator':
            return target_user.role == 'user'

        return False


class UserProfile(models.Model):
    """Extended user profile information"""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    timezone = models.CharField(max_length=50, default='UTC')
    language = models.CharField(max_length=10, default='en')

    # Admin/Moderator specific fields
    department = models.CharField(max_length=100, blank=True)
    employee_id = models.CharField(max_length=50, blank=True)
    is_on_duty = models.BooleanField(default=False)

    # Notification preferences
    email_notifications = models.BooleanField(default=True)
    push_notifications = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"Profile: {self.user.email}"

    def get_full_name(self):
        """Get user's full name"""
        if self.first_name or self.last_name:
            return f"{self.first_name} {self.last_name}".strip()
        return self.user.email


class UserSession(models.Model):
    """Track user sessions for security and analytics"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    session_key = models.CharField(max_length=40, db_index=True)

    # Session details
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    location = models.CharField(max_length=100, blank=True)  # Could be enhanced with geolocation

    # Session timing
    login_time = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    logout_time = models.DateTimeField(null=True, blank=True)

    # Session status
    is_active = models.BooleanField(default=True)
    was_forced_logout = models.BooleanField(default=False)

    class Meta:
        ordering = ['-login_time']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['session_key']),
            models.Index(fields=['ip_address']),
            models.Index(fields=['last_activity']),
        ]
        verbose_name = "User Session"
        verbose_name_plural = "User Sessions"

    def __str__(self):
        return f"Session {self.session_key[:8]}... for {self.user.email}"

    def end_session(self):
        """Mark session as ended"""
        self.is_active = False
        self.logout_time = timezone.now()
        self.save(update_fields=['is_active', 'logout_time'])

    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = timezone.now()
        self.save(update_fields=['last_activity'])

    @property
    def duration(self):
        """Get session duration in seconds"""
        if self.logout_time:
            return (self.logout_time - self.login_time).total_seconds()
        return (timezone.now() - self.login_time).total_seconds()


class LoginAttempt(models.Model):
    """Track login attempts for security monitoring"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Attempt details
    email = models.EmailField()
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)

    # Attempt result
    successful = models.BooleanField(default=False)
    failure_reason = models.CharField(max_length=100, blank=True)

    # Timing
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-attempted_at']
        indexes = [
            models.Index(fields=['email', 'ip_address']),
            models.Index(fields=['successful', 'attempted_at']),
            models.Index(fields=['ip_address', 'attempted_at']),
        ]
        verbose_name = "Login Attempt"
        verbose_name_plural = "Login Attempts"

    def __str__(self):
        return f"Login attempt for {self.email} from {self.ip_address} - {'Success' if self.successful else 'Failed'}"
