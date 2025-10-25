#!/bin/bash
# scripts/generate-secrets.sh - Generate secure secrets for production

echo "🔐 Generating secure secrets for videocall app..."
echo ""

# Generate SECRET_KEY
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
echo "SECRET_KEY generated ✓"

# Generate JWT_SECRET
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
echo "JWT_SECRET generated ✓"

# Generate POSTGRES_PASSWORD
POSTGRES_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "POSTGRES_PASSWORD generated ✓"

echo ""
echo "📝 Creating .env file..."

# Create .env file
cat > .env << EOF
# Django Settings
SECRET_KEY=${SECRET_KEY}
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# JWT Settings
JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DELTA=3600

# Database
POSTGRES_DB=videocall_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0

# SFU Settings
SFU_ENABLED=True
SFU_HOST=sfu
SFU_PORT=8080
MAX_PARTICIPANTS_PER_ROOM=50

# Recording Settings (Enterprise)
ENABLE_RECORDING=True
RECORDING_STORAGE_PATH=recordings/
RECORDING_MAX_DURATION=7200
RECORDING_FORMAT=webm

# CORS Settings
CORS_ALLOWED_ORIGINS=http://localhost,https://your-domain.com

# Email Settings (optional)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

# SSO/LDAP Settings (optional)
ENABLE_LDAP=False
LDAP_SERVER_URI=
LDAP_BIND_DN=
LDAP_BIND_PASSWORD=

# Monitoring (optional)
SENTRY_DSN=
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "⚠️  IMPORTANT: Update the following in .env file:"
echo "   - ALLOWED_HOSTS (add your domain)"
echo "   - CORS_ALLOWED_ORIGINS (add your domain)"
echo ""
echo "📋 Your secrets:"
echo "   SECRET_KEY: ${SECRET_KEY:0:20}..."
echo "   JWT_SECRET: ${JWT_SECRET:0:20}..."
echo "   POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:15}..."
echo ""
echo "🔒 Keep these secrets safe! Never commit .env to git!"
