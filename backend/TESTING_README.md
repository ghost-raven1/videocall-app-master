# Testing Guide for VideoCall Application

This comprehensive testing framework ensures the reliability, security, and performance of the videocall application across frontend, backend, and integration scenarios.

## 🏗️ Test Architecture

### Test Categories

1. **Unit Tests** - Individual component testing
2. **Integration Tests** - Component interaction testing
3. **API Tests** - REST API endpoint testing
4. **WebSocket Tests** - Real-time communication testing
5. **Security Tests** - Authentication and authorization testing
6. **Performance Tests** - Load and stress testing
7. **E2E Tests** - Complete user journey testing

## 📋 Prerequisites

### Backend Testing

```bash
# Install testing dependencies
pip install -r requirements.txt

# Install development dependencies
pip install pytest pytest-django pytest-asyncio pytest-cov
pip install pytest-xdist pytest-mock factory-boy faker
pip install responses
```

### Frontend Testing

```bash
# Navigate to frontend directory
cd videocall-frontend

# Install testing dependencies
npm install

# Install additional testing packages
npm install --save-dev @vitest/coverage-v8 @vitest/ui @vue/test-utils
npm install --save-dev jsdom vitest
```

## 🚀 Running Tests

### Backend Tests

#### Run All Tests
```bash
# Basic test run
pytest

# With coverage
pytest --cov=apps --cov-report=html

# Verbose output
pytest -v

# Parallel execution
pytest -n auto

# Specific test markers
pytest -m "unit or integration"
pytest -m "security"
pytest -m "performance"
pytest -m "websocket"
```

#### Run Tests by Component
```bash
# Authentication tests
pytest apps/authentication/ -v

# Core system tests
pytest apps/core/ -v

# Room management tests
pytest apps/rooms/ -v

# All tests with coverage
pytest --cov=apps --cov-report=html --cov-report=xml
```

#### Run Tests by Type
```bash
# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# API tests only
pytest -m api

# Security tests only
pytest -m security

# Performance tests only
pytest -m performance

# WebSocket tests only
pytest -m websocket
```

### Frontend Tests

#### Run All Frontend Tests
```bash
cd videocall-frontend

# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Run tests with coverage
npm run test:coverage
```

#### Run Specific Test Files
```bash
# Run specific component tests
npm run test LoginForm.test.js
npm run test VideoCall.test.js
npm run test webrtc.test.js
```

## 📊 Coverage Reports

### Backend Coverage
```bash
# Generate HTML coverage report
pytest --cov=apps --cov-report=html

# Generate XML coverage report (for CI)
pytest --cov=apps --cov-report=xml

# Coverage thresholds
pytest --cov=apps --cov-fail-under=80
```

Coverage reports are generated in:
- `htmlcov/index.html` - HTML report
- `coverage.xml` - XML report for CI integration

### Frontend Coverage
```bash
cd videocall-frontend
npm run test:coverage
```

Coverage reports are generated in:
- `coverage/` - Coverage reports and data

## 🔧 Test Configuration

### Pytest Configuration (`pytest.ini`)

```ini
[tool:pytest]
DJANGO_SETTINGS_MODULE = videocall_app.settings
testpaths = apps
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    --strict-markers
    --strict-config
    --cov=apps
    --cov-report=html
    --cov-report=term-missing
    --cov-report=xml
    --cov-fail-under=80
    -ra
    --tb=short
    -v
```

### Vitest Configuration (`vitest.config.js`)

```javascript
export default {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
}
```

## 🧪 Test Structure

### Backend Test Structure

```
backend/apps/
├── authentication/
│   └── tests.py          # Authentication & authorization tests
├── core/
│   └── tests.py          # System settings & activity logging tests
├── rooms/
│   └── tests.py          # Room management & WebSocket tests
├── test_utils.py         # Test factories & utilities
└── conftest.py           # Pytest configuration & fixtures
```

### Frontend Test Structure

```
videocall-frontend/src/
├── components/
│   └── __tests__/
│       ├── LoginForm.test.js
│       ├── VideoCall.test.js
│       └── ...
├── services/
│   └── __tests__/
│       ├── webrtc.test.js
│       ├── api.test.js
│       └── ...
├── test/
│   ├── setup.js          # Test environment setup
│   └── utils.js          # Test utilities
└── stores/
    └── __tests__/
        ├── webrtc.test.js
        └── ...
```

## 🎯 Key Test Scenarios

### Authentication Tests
- ✅ JWT token generation and validation
- ✅ Cookie-based authentication
- ✅ Role-based access control
- ✅ Password security
- ✅ Session management
- ✅ Login attempt tracking

### Room Management Tests
- ✅ Room creation and lifecycle
- ✅ Participant joining/leaving
- ✅ Room capacity limits
- ✅ Room expiry handling
- ✅ SFU threshold detection
- ✅ Room cleanup and deletion

### WebRTC Tests
- ✅ Peer connection establishment
- ✅ Media stream handling
- ✅ WebRTC statistics collection
- ✅ Connection quality monitoring
- ✅ Fallback mode handling
- ✅ Error recovery mechanisms

### Security Tests
- ✅ Authentication bypass attempts
- ✅ Authorization level testing
- ✅ Input validation
- ✅ Rate limiting simulation
- ✅ XSS protection
- ✅ CSRF protection

### Performance Tests
- ✅ Bulk room operations
- ✅ Concurrent user handling
- ✅ Database query optimization
- ✅ Memory usage monitoring
- ✅ Response time measurement

## 🔍 Debugging Tests

### Common Issues and Solutions

#### Backend Test Issues

1. **Database Connection Issues**
   ```bash
   # Check database configuration
   python manage.py showmigrations

   # Reset test database
   python manage.py test --keepdb
   ```

2. **Redis Connection Issues**
   ```bash
   # Test Redis connection
   python -c "import redis; r = redis.Redis(); print(r.ping())"
   ```

3. **Missing Migrations**
   ```bash
   # Generate and run migrations
   python manage.py makemigrations
   python manage.py migrate
   ```

#### Frontend Test Issues

1. **Module Resolution Issues**
   ```bash
   # Clear npm cache
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Environment Setup Issues**
   ```bash
   # Check if jsdom is properly configured
   npm ls jsdom

   # Verify Vue Test Utils installation
   npm ls @vue/test-utils
   ```

## 📈 Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:6-alpine
        ports:
          - 6379:6379
      postgres:
        image: postgres:13-alpine
        env:
          POSTGRES_DB: test_videocall
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v2
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.9'

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt

    - name: Run migrations
      run: python manage.py migrate

    - name: Run tests
      run: pytest --cov=apps --cov-report=xml

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v1

  frontend-tests:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2
    - name: Set up Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'

    - name: Install dependencies
      run: |
        cd videocall-frontend
        npm ci

    - name: Run tests
      run: |
        cd videocall-frontend
        npm run test:run
```

## 🎛️ Custom Test Commands

### Backend Custom Commands

```bash
# Run tests with specific Django settings
DJANGO_SETTINGS_MODULE=videocall_app.settings pytest

# Run tests with custom database
pytest --ds=videocall_app.settings

# Run tests with environment variables
ADMIN_PASSWORD=test123 pytest

# Run tests with Redis
REDIS_URL=redis://localhost:6379/1 pytest
```

### Frontend Custom Commands

```bash
# Run tests with custom environment
VITE_API_URL=http://localhost:8000 npm run test

# Run tests with coverage thresholds
npm run test:coverage -- --coverage.reporter=json-summary

# Run tests in debug mode
DEBUG=test npm run test
```

## 📊 Test Metrics

### Target Coverage Thresholds

| Component | Branches | Functions | Lines | Statements |
|-----------|----------|-----------|-------|------------|
| Backend   | 80%      | 80%       | 80%   | 80%        |
| Frontend  | 80%      | 80%       | 80%   | 80%        |
| Services  | 90%      | 90%       | 90%   | 90%        |

### Performance Benchmarks

- **Room Creation**: < 100ms per room
- **User Authentication**: < 200ms per login
- **WebSocket Connection**: < 500ms connection time
- **Video Call Setup**: < 2s end-to-end

## 🛠️ Development Workflow

### Writing New Tests

1. **Identify Test Type**
   - Unit test for individual functions
   - Integration test for component interactions
   - E2E test for complete user journeys

2. **Follow Naming Conventions**
   - `test_<functionality>.py` for test files
   - `test_<specific_feature>` for test functions
   - `Test<Feature>Class` for test classes

3. **Use Test Utilities**
   ```python
   # Backend
   from apps.test_utils import BaseTestCase, UserFactory

   class MyTest(BaseTestCase):
       def test_something(self):
           user = self.create_test_user()
           # Test implementation
   ```

   ```javascript
   // Frontend
   import { render, testUtils } from '@/test/utils'

   describe('MyComponent', () => {
     it('should work', () => {
       const user = testUtils.createMockUser()
       // Test implementation
     })
   })
   ```

### Test-Driven Development (TDD)

1. Write failing test first
2. Implement minimal code to pass test
3. Refactor and improve
4. Ensure all tests pass

## 🔒 Security Testing

### Authentication Security Tests

```bash
# Run security-specific tests
pytest -m security

# Test authentication bypass attempts
pytest apps/authentication/tests.py::SecurityTestCase

# Test authorization levels
pytest apps/authentication/tests.py::UserModelTestCase::test_can_manage_user
```

### Input Validation Tests

```bash
# Test malicious input handling
pytest -k "validation"

# Test XSS protection
pytest -k "xss"

# Test SQL injection protection
pytest -k "injection"
```

## 🚀 Load Testing

### Backend Load Testing

```bash
# Run load tests
cd tests/
./run-load-tests.sh

# Custom load test scenarios
pytest tests/load-test-config.yml --html=load-test-report.html
```

### Frontend Load Testing

```bash
# Install load testing tools
npm install --save-dev @playwright/test puppeteer

# Run browser-based load tests
npm run test:e2e:load
```

## 📋 Test Checklists

### Pre-Deployment Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Coverage meets thresholds
- [ ] Security tests pass
- [ ] Performance tests pass
- [ ] No linting errors
- [ ] Database migrations tested

### Code Review Checklist

- [ ] Tests cover happy path scenarios
- [ ] Tests cover edge cases and error conditions
- [ ] Tests are readable and maintainable
- [ ] Tests use appropriate mocking
- [ ] Tests are properly isolated
- [ ] Tests have descriptive names and assertions

## 🤝 Contributing

### Adding New Tests

1. Create test file in appropriate directory
2. Follow existing naming conventions
3. Add appropriate markers for test categorization
4. Include docstrings explaining test purpose
5. Update this README if needed

### Test Maintenance

1. Keep tests up-to-date with code changes
2. Remove obsolete tests
3. Update test data factories as models evolve
4. Monitor test performance and optimize slow tests
5. Regularly review and improve test coverage

## 📞 Support

For issues with the testing framework:

1. Check the troubleshooting section
2. Review test configuration
3. Verify dependencies are installed correctly
4. Check for conflicting test markers
5. Ensure test isolation

## 📚 Additional Resources

- [Django Testing Documentation](https://docs.djangoproject.com/en/stable/topics/testing/)
- [Pytest Documentation](https://docs.pytest.org/)
- [Vue Testing Handbook](https://vue-test-utils.vuejs.org/)
- [Vitest Documentation](https://vitest.dev/)
- [REST Framework Testing](https://www.django-rest-framework.org/api-guide/testing/)