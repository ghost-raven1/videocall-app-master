from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User, UserProfile, UserSession, LoginAttempt


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "last_activity",
        "created_at",
        "updated_at",
    )
    list_filter = ("role", "is_active", "is_staff", "is_superuser")
    search_fields = ("email",)
    readonly_fields = ("last_activity", "created_at", "updated_at")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal info"), {"fields": ()}),
        (
            _("Permissions"),
            {
                "fields": (
                    "role",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "last_activity", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "role",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                ),
            },
        ),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "first_name",
        "last_name",
        "phone",
        "timezone",
        "language",
        "department",
        "employee_id",
        "is_on_duty",
    )
    list_filter = ("language", "timezone", "is_on_duty")
    search_fields = ("user__email", "first_name", "last_name", "phone", "department", "employee_id")


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "session_key",
        "ip_address",
        "login_time",
        "last_activity",
        "logout_time",
        "is_active",
        "was_forced_logout",
    )
    list_filter = ("is_active", "was_forced_logout", "login_time")
    search_fields = ("user__email", "session_key", "ip_address")
    readonly_fields = ("login_time", "last_activity", "logout_time")


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ("email", "ip_address", "successful", "failure_reason", "attempted_at")
    list_filter = ("successful", "attempted_at")
    search_fields = ("email", "ip_address", "failure_reason")
    readonly_fields = ("email", "ip_address", "user_agent", "successful", "failure_reason", "attempted_at")
