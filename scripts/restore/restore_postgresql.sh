#!/bin/bash

# PostgreSQL Restoration Script for VideoCall Application
# Supports full and incremental backup restoration with verification

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT_DIR="${BACKUP_ROOT_DIR:-/backups/postgresql}"
BACKUP_DIR="${BACKUP_ROOT_DIR}/daily"
LOG_DIR="/var/log/videocall-backup"
LOG_FILE="${LOG_DIR}/postgresql_restore.log"

# Database configuration
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-videocall_db}"
DB_USER="${POSTGRES_USER:-postgres}"

# Restoration options
ENCRYPTION_KEY_FILE="/etc/videocall-backup/backup.key"
RESTORE_TYPE="${RESTORE_TYPE:-latest}"  # latest, timestamp:YYYYMMDD_HHMMSS, or specific_file
TARGET_TIMESTAMP="${TARGET_TIMESTAMP:-}"
SPECIFIC_BACKUP_FILE="${SPECIFIC_BACKUP_FILE:-}"

# Ensure required environment variables are set
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    echo "ERROR: POSTGRES_PASSWORD environment variable is required"
    exit 1
fi

# Create directories
setup_directories() {
    echo "Setting up directories..."
    mkdir -p "${LOG_DIR}"
}

# Setup logging
setup_logging() {
    exec > >(tee -a "${LOG_FILE}") 2>&1
    echo "=== PostgreSQL Restoration Started at $(date) ==="
}

# Check database connectivity
check_database() {
    echo "Checking database connectivity..."
    if ! pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" >/dev/null 2>&1; then
        echo "ERROR: Cannot connect to PostgreSQL database"
        exit 1
    fi
    echo "Database connection successful"
}

# List available backups
list_backups() {
    echo "Available backup files:"
    echo "======================"

    if [[ ! -d "${BACKUP_DIR}" ]]; then
        echo "ERROR: Backup directory does not exist: ${BACKUP_DIR}"
        exit 1
    fi

    local count=0
    while IFS= read -r -d '' file; do
        count=$((count + 1))
        local filename
        local timestamp
        local backup_type
        local size

        filename=$(basename "${file}")
        size=$(stat -f%z "${file}" 2>/dev/null || stat -c%s "${file}" 2>/dev/null || echo "0")

        # Extract timestamp from filename
        if [[ "${filename}" =~ full_backup_([0-9]{8})_([0-9]{6})\.dump\.enc ]]; then
            timestamp="${BASH_REMATCH[1]}_${BASH_REMATCH[2]}"
            backup_type="full"
        elif [[ "${filename}" =~ incremental_backup_([0-9]{8})_([0-9]{6})\.dump\.enc ]]; then
            timestamp="${BASH_REMATCH[1]}_${BASH_REMATCH[2]}"
            backup_type="incremental"
        else
            timestamp="unknown"
            backup_type="unknown"
        fi

        printf "%-3d) %-40s %-12s %-10s %s\n" \
            "${count}" \
            "${filename}" \
            "${backup_type}" \
            "$(date -r "${file}" '+%Y-%m-%d %H:%M')" \
            "$(numfmt --to=iec "${size}")"
    done < <(find "${BACKUP_DIR}" -name "*.enc" -type f -print0 | sort -z)

    if [[ $count -eq 0 ]]; then
        echo "No backup files found in ${BACKUP_DIR}"
        exit 1
    fi
}

# Decrypt backup file
decrypt_backup() {
    local encrypted_file="$1"
    local decrypted_file="$2"

    echo "Decrypting backup file: ${encrypted_file}"

    if [[ ! -f "${ENCRYPTION_KEY_FILE}" ]]; then
        echo "ERROR: Encryption key file not found: ${ENCRYPTION_KEY_FILE}"
        exit 1
    fi

    if ! openssl enc -aes-256-cbc -d \
        -in "${encrypted_file}" \
        -out "${decrypted_file}" \
        -pass file:"${ENCRYPTION_KEY_FILE}"; then
        echo "ERROR: Failed to decrypt backup file"
        exit 1
    fi

    echo "Backup decrypted successfully"
}

# Verify backup before restoration
verify_backup_before_restore() {
    local backup_file="$1"

    echo "Verifying backup file before restoration..."

    # Basic file checks
    if [[ ! -f "${backup_file}" ]]; then
        echo "ERROR: Backup file does not exist: ${backup_file}"
        return 1
    fi

    # Check if it's a valid PostgreSQL dump
    local temp_file
    temp_file=$(mktemp)

    # Try to decrypt and check the header
    if ! decrypt_backup "${backup_file}" "${temp_file}"; then
        echo "ERROR: Backup verification failed - cannot decrypt"
        return 1
    fi

    # Check if it's a valid PostgreSQL custom-format dump
    if ! head -c 1024 "${temp_file}" | grep -q "PGDMP"; then
        echo "ERROR: Backup file is not a valid PostgreSQL dump"
        rm -f "${temp_file}"
        return 1
    fi

    rm -f "${temp_file}"
    echo "Backup verification successful"
    return 0
}

# Find backup file based on restoration type
find_backup_file() {
    case "${RESTORE_TYPE}" in
        "latest")
            find "${BACKUP_DIR}" -name "*.enc" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-
            ;;
        "timestamp")
            if [[ -z "${TARGET_TIMESTAMP}" ]]; then
                echo "ERROR: TARGET_TIMESTAMP must be specified when using timestamp restoration type"
                exit 1
            fi
            find "${BACKUP_DIR}" -name "*backup_${TARGET_TIMESTAMP}*.enc" -type f | head -1
            ;;
        "specific")
            if [[ -z "${SPECIFIC_BACKUP_FILE}" ]]; then
                echo "ERROR: SPECIFIC_BACKUP_FILE must be specified when using specific file restoration type"
                exit 1
            fi
            echo "${SPECIFIC_BACKUP_FILE}"
            ;;
        *)
            echo "ERROR: Invalid RESTORE_TYPE. Must be: latest, timestamp, or specific"
            exit 1
            ;;
    esac
}

# Create pre-restore database backup
create_pre_restore_backup() {
    echo "Creating pre-restore backup for safety..."
    local pre_restore_backup
    pre_restore_backup="${BACKUP_DIR}/pre_restore_$(date +%Y%m%d_%H%M%S).dump"

    PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="${DB_NAME}" \
        --no-password \
        --format=custom \
        --compress=9 \
        --file="${pre_restore_backup}"

    echo "Pre-restore backup created: ${pre_restore_backup}"
}

# Restore from backup
restore_from_backup() {
    local backup_file="$1"

    echo "Starting restoration from: ${backup_file}"

    # Create temporary file for decrypted backup
    local temp_backup
    temp_backup=$(mktemp)

    # Decrypt the backup
    decrypt_backup "${backup_file}" "${temp_backup}"

    # Drop existing database and recreate (WARNING: This will destroy current data)
    echo "WARNING: This will destroy all existing data in database '${DB_NAME}'"
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Restoration cancelled by user"
        rm -f "${temp_backup}"
        exit 0
    fi

    echo "Dropping existing database connections and database..."
    # Terminate existing connections
    PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --no-password \
        --command="SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();"

    # Drop and recreate database
    PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --no-password \
        --command="DROP DATABASE IF EXISTS ${DB_NAME};"

    PGPASSWORD="${POSTGRES_PASSWORD}" createdb \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --no-password \
        "${DB_NAME}"

    echo "Restoring from backup..."
    # Restore from the decrypted backup
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="${DB_NAME}" \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        "${temp_backup}"

    # Clean up temporary file
    rm -f "${temp_backup}"

    echo "Database restoration completed successfully"
}

# Verify restoration
verify_restoration() {
    echo "Verifying restoration..."

    # Check if database exists and is accessible
    if ! PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="${DB_NAME}" \
        --no-password \
        --command="SELECT 1;" >/dev/null 2>&1; then
        echo "ERROR: Database verification failed"
        return 1
    fi

    # Check for essential tables (adjust based on your application)
    local essential_tables=("authentication_user" "core_room" "rooms_room")
    for table in "${essential_tables[@]}"; do
        if ! PGPASSWORD="${POSTGRES_PASSWORD}" psql \
            --host="${DB_HOST}" \
            --port="${DB_PORT}" \
            --username="${DB_USER}" \
            --dbname="${DB_NAME}" \
            --no-password \
            --command="SELECT COUNT(*) FROM ${table} LIMIT 1;" >/dev/null 2>&1; then
            echo "WARNING: Table '${table}' not found or empty"
        fi
    done

    echo "Restoration verification completed"
}

# Main execution
main() {
    setup_directories
    setup_logging
    check_database

    # List available backups if no specific file is provided
    if [[ -z "${SPECIFIC_BACKUP_FILE}" ]] && [[ "${RESTORE_TYPE}" != "specific" ]]; then
        list_backups
        echo ""
    fi

    # Find the backup file to restore from
    local backup_file
    backup_file=$(find_backup_file)

    if [[ -z "${backup_file}" ]]; then
        echo "ERROR: No backup file found"
        exit 1
    fi

    if [[ ! -f "${backup_file}" ]]; then
        echo "ERROR: Backup file does not exist: ${backup_file}"
        exit 1
    fi

    echo "Selected backup file: ${backup_file}"

    # Verify backup before restoration
    if ! verify_backup_before_restore "${backup_file}"; then
        echo "ERROR: Backup verification failed"
        exit 1
    fi

    # Create pre-restore backup for safety
    create_pre_restore_backup

    # Perform restoration
    restore_from_backup "${backup_file}"

    # Verify restoration
    if ! verify_restoration; then
        echo "ERROR: Restoration verification failed"
        exit 1
    fi

    echo "=== PostgreSQL Restoration Completed Successfully at $(date) ==="
    echo "Database '${DB_NAME}' has been restored from ${backup_file}"
}

# Show usage if no arguments provided
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE         Restoration type: latest, timestamp, specific (default: latest)"
    echo "  -T, --timestamp TS      Target timestamp (YYYYMMDD_HHMMSS) for timestamp type"
    echo "  -f, --file FILE         Specific backup file path for specific type"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Restore from latest backup"
    echo "  $0 -t timestamp -T 20231201_120000   # Restore from specific timestamp"
    echo "  $0 -t specific -f /path/to/backup.enc # Restore from specific file"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            RESTORE_TYPE="$2"
            shift 2
            ;;
        -T|--timestamp)
            TARGET_TIMESTAMP="$2"
            shift 2
            ;;
        -f|--file)
            SPECIFIC_BACKUP_FILE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main function
main "$@"