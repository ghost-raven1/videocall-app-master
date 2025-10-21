#!/usr/bin/env python3
"""
Test runner script for the videocall application.
Provides convenient commands for running different types of tests.
"""
import os
import sys
import argparse
import subprocess
from pathlib import Path


def run_command(cmd, cwd=None):
    """Run a shell command and return the result."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)


def check_dependencies():
    """Check if required testing dependencies are installed."""
    required_packages = [
        'pytest',
        'pytest-django',
        'pytest-asyncio',
        'pytest-cov',
        'factory-boy',
        'faker'
    ]

    missing_packages = []

    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)

    if missing_packages:
        print(f"❌ Missing required packages: {', '.join(missing_packages)}")
        print("Run: pip install -r requirements.txt")
        return False

    print("✅ All testing dependencies are installed")
    return True


def run_backend_tests(args):
    """Run backend Django tests."""
    print("🧪 Running Backend Tests...")

    if not check_dependencies():
        return False

    # Build pytest command
    cmd_parts = ['python', '-m', 'pytest']

    if args.verbose:
        cmd_parts.append('-v')

    if args.coverage:
        cmd_parts.extend(['--cov=apps', '--cov-report=html', '--cov-report=term-missing'])

    if args.parallel:
        cmd_parts.extend(['-n', 'auto'])

    if args.markers:
        for marker in args.markers:
            cmd_parts.extend(['-m', marker])

    if args.file:
        cmd_parts.append(args.file)

    if args.fail_fast:
        cmd_parts.append('-x')

    if args.debug:
        cmd_parts.append('--pdb')

    if args.keep_db:
        cmd_parts.append('--keepdb')

    # Add default arguments
    cmd_parts.extend([
        '--tb=short',
        '-ra'
    ])

    cmd = ' '.join(cmd_parts)
    print(f"Running: {cmd}")

    success, stdout, stderr = run_command(cmd, cwd='backend')

    if success:
        print("✅ Backend tests passed!")
        if args.coverage:
            print("📊 Coverage report generated in backend/htmlcov/index.html")
    else:
        print("❌ Backend tests failed!")
        print("STDOUT:", stdout)
        print("STDERR:", stderr)

    return success


def run_frontend_tests(args):
    """Run frontend Vue.js tests."""
    print("🧪 Running Frontend Tests...")

    # Check if frontend directory exists
    frontend_dir = Path('videocall-frontend')
    if not frontend_dir.exists():
        print("❌ Frontend directory not found")
        return False

    # Build npm command
    if args.watch:
        cmd = 'npm run test:watch'
    elif args.coverage:
        cmd = 'npm run test:coverage'
    elif args.ui:
        cmd = 'npm run test:ui'
    else:
        cmd = 'npm run test:run'

    print(f"Running: {cmd}")

    success, stdout, stderr = run_command(cmd, cwd='videocall-frontend')

    if success:
        print("✅ Frontend tests passed!")
        if args.coverage:
            print("📊 Coverage report generated in videocall-frontend/coverage/")
    else:
        print("❌ Frontend tests failed!")
        print("STDOUT:", stdout)
        print("STDERR:", stderr)

    return success


def run_load_tests(args):
    """Run load and performance tests."""
    print("🚀 Running Load Tests...")

    tests_dir = Path('tests')
    if not tests_dir.exists():
        print("❌ Tests directory not found")
        return False

    # Run load test script if it exists
    load_script = tests_dir / 'run-load-tests.sh'
    if load_script.exists():
        cmd = str(load_script)
        success, stdout, stderr = run_command(cmd)
    else:
        print("⚠️  Load test script not found, running basic performance tests...")
        cmd = 'python -m pytest tests/ -m performance -v'
        success, stdout, stderr = run_command(cmd)

    if success:
        print("✅ Load tests completed!")
    else:
        print("❌ Load tests failed!")
        print("STDOUT:", stdout)
        print("STDERR:", stderr)

    return success


def run_security_tests(args):
    """Run security-specific tests."""
    print("🔒 Running Security Tests...")

    cmd_parts = ['python', '-m', 'pytest', '-m', 'security', '-v']

    if args.verbose:
        cmd_parts.append('-v')

    if args.coverage:
        cmd_parts.extend(['--cov=apps', '--cov-report=html'])

    cmd = ' '.join(cmd_parts)
    print(f"Running: {cmd}")

    success, stdout, stderr = run_command(cmd, cwd='backend')

    if success:
        print("✅ Security tests passed!")
    else:
        print("❌ Security tests failed!")
        print("STDOUT:", stdout)
        print("STDERR:", stderr)

    return success


def run_integration_tests(args):
    """Run integration tests."""
    print("🔗 Running Integration Tests...")

    cmd_parts = ['python', '-m', 'pytest', '-m', 'integration', '-v']

    if args.verbose:
        cmd_parts.append('-v')

    cmd = ' '.join(cmd_parts)
    print(f"Running: {cmd}")

    success, stdout, stderr = run_command(cmd, cwd='backend')

    if success:
        print("✅ Integration tests passed!")
    else:
        print("❌ Integration tests failed!")
        print("STDOUT:", stdout)
        print("STDERR:", stderr)

    return success


def run_websocket_tests(args):
    """Run WebSocket tests."""
    print("🔌 Running WebSocket Tests...")

    cmd_parts = ['python', '-m', 'pytest', '-m', 'websocket', '-v']

    if args.verbose:
        cmd_parts.append('-v')

    cmd = ' '.join(cmd_parts)
    print(f"Running: {cmd}")

    success, stdout, stderr = run_command(cmd, cwd='backend')

    if success:
        print("✅ WebSocket tests passed!")
    else:
        print("❌ WebSocket tests failed!")
        print("STDOUT:", stdout)
        print("STDERR:", stderr)

    return success


def run_all_tests(args):
    """Run all tests."""
    print("🏃 Running All Tests...")

    test_results = []

    # Backend tests
    if args.include_backend:
        test_results.append(run_backend_tests(args))

    # Frontend tests
    if args.include_frontend:
        test_results.append(run_frontend_tests(args))

    # Load tests
    if args.include_load:
        test_results.append(run_load_tests(args))

    # Summary
    passed = sum(test_results)
    total = len(test_results)

    if passed == total:
        print(f"🎉 All {total} test suites passed!")
        return True
    else:
        print(f"❌ {total - passed} of {total} test suites failed!")
        return False


def setup_test_environment(args):
    """Set up test environment."""
    print("🔧 Setting up test environment...")

    # Install backend dependencies
    if args.include_backend:
        print("Installing backend dependencies...")
        success, _, stderr = run_command('pip install -r requirements.txt', cwd='backend')
        if not success:
            print(f"❌ Failed to install backend dependencies: {stderr}")
            return False

    # Install frontend dependencies
    if args.include_frontend:
        print("Installing frontend dependencies...")
        success, _, stderr = run_command('npm install', cwd='videocall-frontend')
        if not success:
            print(f"❌ Failed to install frontend dependencies: {stderr}")
            return False

    print("✅ Test environment setup complete")
    return True


def generate_coverage_report(args):
    """Generate comprehensive coverage report."""
    print("📊 Generating Coverage Report...")

    # Backend coverage
    if args.include_backend:
        print("Generating backend coverage...")
        cmd = 'python -m pytest --cov=apps --cov-report=html --cov-report=xml'
        success, _, stderr = run_command(cmd, cwd='backend')
        if success:
            print("✅ Backend coverage report generated")
        else:
            print(f"❌ Backend coverage failed: {stderr}")

    # Frontend coverage
    if args.include_frontend:
        print("Generating frontend coverage...")
        cmd = 'npm run test:coverage'
        success, _, stderr = run_command(cmd, cwd='videocall-frontend')
        if success:
            print("✅ Frontend coverage report generated")
        else:
            print(f"❌ Frontend coverage failed: {stderr}")

    print("📋 Coverage reports generated:")
    print("  Backend: backend/htmlcov/index.html")
    print("  Frontend: videocall-frontend/coverage/")

    return True


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Test runner for videocall application')

    # Test type selection
    parser.add_argument('--backend', action='store_true', help='Run backend tests')
    parser.add_argument('--frontend', action='store_true', help='Run frontend tests')
    parser.add_argument('--load', action='store_true', help='Run load tests')
    parser.add_argument('--security', action='store_true', help='Run security tests')
    parser.add_argument('--integration', action='store_true', help='Run integration tests')
    parser.add_argument('--websocket', action='store_true', help='Run WebSocket tests')
    parser.add_argument('--all', action='store_true', help='Run all tests')

    # Test options
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--coverage', action='store_true', help='Generate coverage reports')
    parser.add_argument('--parallel', action='store_true', help='Run tests in parallel')
    parser.add_argument('--fail-fast', action='store_true', help='Stop on first failure')
    parser.add_argument('--debug', action='store_true', help='Run tests in debug mode')
    parser.add_argument('--keep-db', action='store_true', help='Keep test database')

    # Specific test targeting
    parser.add_argument('--file', help='Run specific test file')
    parser.add_argument('--markers', nargs='+', help='Run tests with specific markers')

    # Frontend-specific options
    parser.add_argument('--watch', action='store_true', help='Run frontend tests in watch mode')
    parser.add_argument('--ui', action='store_true', help='Run frontend tests with UI')

    # Setup and reporting
    parser.add_argument('--setup', action='store_true', help='Setup test environment')
    parser.add_argument('--report', action='store_true', help='Generate coverage reports only')

    # Include options for --all
    parser.add_argument('--include-backend', action='store_true', default=True)
    parser.add_argument('--include-frontend', action='store_true', default=True)
    parser.add_argument('--include-load', action='store_true', default=False)

    args = parser.parse_args()

    # Default behavior: run all tests if no specific type selected
    if not any([args.backend, args.frontend, args.load, args.security,
                args.integration, args.websocket, args.all, args.setup, args.report]):
        args.all = True

    # Execute commands
    if args.setup:
        return setup_test_environment(args)
    elif args.report:
        return generate_coverage_report(args)
    elif args.all:
        return run_all_tests(args)
    elif args.backend:
        return run_backend_tests(args)
    elif args.frontend:
        return run_frontend_tests(args)
    elif args.load:
        return run_load_tests(args)
    elif args.security:
        return run_security_tests(args)
    elif args.integration:
        return run_integration_tests(args)
    elif args.websocket:
        return run_websocket_tests(args)
    else:
        print("❌ No test type specified. Use --help for options.")
        return False


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)