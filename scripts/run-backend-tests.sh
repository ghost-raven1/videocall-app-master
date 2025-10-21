#!/bin/bash

# Backend Testing Script for CI/CD Pipeline
# This script runs comprehensive tests for the Django backend

set -e  # Exit on any error

echo "🚀 Starting backend tests..."

# Set up environment variables
export DJANGO_SETTINGS_MODULE=videocall_app.settings
export USE_TZ=True
export DB_ENGINE=${DB_ENGINE:-postgresql}
export DB_HOST=${DB_HOST:-localhost}
export DB_PORT=${DB_PORT:-5432}
export REDIS_URL=${REDIS_URL:-redis://localhost:6379/0}

# Navigate to backend directory
cd backend

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Wait for database if needed
if [ "$DB_ENGINE" = "postgresql" ]; then
    echo "🗄️ Waiting for PostgreSQL database..."
    python -c "
import psycopg2
import time
import os

max_retries = 30
for i in range(max_retries):
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'test_password'),
            database=os.getenv('DB_NAME', 'test_videocall')
        )
        conn.close()
        print('✅ Database connection successful')
        break
    except psycopg2.OperationalError as e:
        print(f'⏳ Waiting for database... (attempt {i+1}/{max_retries})')
        time.sleep(2)
        if i == max_retries - 1:
            print('❌ Database connection failed')
            raise e
"
fi

# Wait for Redis if needed
if [[ "$REDIS_URL" == redis://* ]]; then
    echo "🔴 Waiting for Redis..."
    python -c "
import redis
import time
import os

max_retries = 30
for i in range(max_retries):
    try:
        r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
        r.ping()
        print('✅ Redis connection successful')
        break
    except redis.ConnectionError as e:
        print(f'⏳ Waiting for Redis... (attempt {i+1}/{max_retries})')
        time.sleep(2)
        if i == max_retries - 1:
            print('❌ Redis connection failed')
            raise e
"
fi

# Run Django migrations
echo "🗄️ Running database migrations..."
python manage.py migrate --verbosity=2

# Create test database
echo "🧪 Creating test database..."
python manage.py test --settings=videocall_app.settings --debug-mode

# Run tests with coverage
echo "🧪 Running tests with coverage..."
python -m pytest \
    --cov=apps \
    --cov-report=html \
    --cov-report=term-missing \
    --cov-report=xml:coverage.xml \
    --junitxml=test-results.xml \
    --tb=short \
    -v \
    apps/

# Run additional test categories
echo "🔐 Running security tests..."
python -m pytest -m security -v

echo "🚀 Running performance tests..."
python -m pytest -m performance -v

echo "🌐 Running WebSocket tests..."
python -m pytest -m websocket -v

# Run integration tests
echo "🔗 Running integration tests..."
python -m pytest -m integration -v

# Generate coverage badge if genbadge is available
if command -v genbadge &> /dev/null; then
    echo "🏷️ Generating coverage badge..."
    coverage-badge -o ../coverage.svg
fi

echo "✅ Backend tests completed successfully"

# Output test summary
echo "📊 Test Summary:"
echo "Coverage report: $(pwd)/htmlcov/index.html"
echo "Test results: $(pwd)/test-results.xml"
echo "Coverage XML: $(pwd)/coverage.xml"

# Exit with proper code
exit 0