
#!/bin/bash

# Redis Backup Script for VideoCall Application
# Implements encrypted, persistent Redis data backup with verification

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT_DIR="/backups/redis"
BACKUP_DIR="${BACKUP_ROOT_DIR}/daily"
LOG_DIR="/var/log/videocall-backup"
LOG_FILE="${LOG_DIR}/redis_backup.log"

# Redis configuration
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_DB="${REDIS_DB:-0}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# Backup configuration
RETENTION_DAYS=${RETENTION_DAYS:-30}
ENCRYPTION_KEY_FILE="/etc/videocall-backup/backup.key"
COMPRESSION_LEVEL=${COMPRESSION_LEVEL:-9}

# Create directories
setup_directories() {
    echo "Setting up Redis backup directories..."
    mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"
    chmod 750 "${BACKUP_ROOT_DIR}" "${LOG_DIR}"
    chown -R root:root "${BACKUP_ROOT_DIR}" "${LOG_DIR}"
}

# Setup logging
setup_logging() {
    exec > >(tee -a "${LOG_FILE}") 2>&1
    echo "=== Redis Backup Started at $(date) ==="
}

# Setup encryption key
setup_encryption() {
    if [[ ! -f "${ENCRYPTION_KEY_FILE}" ]]; then
        echo "Generating Redis encryption key..."
        mkdir -p "$(dirname "${ENCRYPTION_KEY_FILE}")"
        openssl rand -base64 32 > "${ENCRYPTION_KEY_FILE}"
        chmod 600 "${ENCRYPTION_KEY_FILE}"
        chown root:root "${ENCRYPTION_KEY_FILE}"
    fi
}

# Check Redis connectivity
check_redis() {
    echo "Checking Redis connectivity..."

    local redis_cli_args=("-h" "${REDIS_HOST}" "-p" "${REDIS_PORT}")

    if [[ -n "${REDIS_PASSWORD}" ]]; then
        redis_cli_args+=("-a" "${REDIS_PASSWORD}")
    fi

    # Test basic connectivity
    if ! redis-cli "${redis_cli_args[@]}" ping >/dev/null 2>&1; then
        echo "ERROR: Cannot connect to Redis server"
        exit 1
    fi

    # Get Redis info
    local info
    info=$(redis-cli "${redis_cli_args[@]}" info server 2>/dev/null)

    if [[ -z "${info}" ]]; then
        echo "ERROR: Cannot retrieve Redis server information"
        exit 1
    fi

    echo "Redis connection successful"
    echo "Redis server info:"
    echo "${info}" | grep -E "(redis_version|redis_mode|os|tcp_port|connected_clients|rdb_bgsave_in_progress|aof_enabled)" || true
}

# Get Redis database size and key count
get_redis_stats() {
    local redis_cli_args=("-h" "${REDIS_HOST}" "-p" "${REDIS_PORT}")

    if [[ -n "${REDIS_PASSWORD}" ]]; then
        redis_cli_args+=("-a" "${REDIS_PASSWORD}")
    fi

    echo "Getting Redis database statistics..."

    # Get key count for the specific database
    local key_count
    key_count=$(redis-cli "${redis_cli_args[@]}" --scan --pattern "*" | wc -l)

    # Get memory usage
    local memory_info
    memory_info=$(redis-cli "${redis_cli_args[@]}" info memory 2>/dev/null | grep used_memory_human || echo "used_memory_human:unknown")

    echo "Redis DB ${REDIS_DB} statistics:"
    echo "  Keys: ${key_count}"
    echo "  Memory: ${memory_info}"
}

# Create Redis backup using multiple methods
create_redis_backup() {
    local timestamp
    local backup_file
    local encrypted_file
    local metadata_file

    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="${BACKUP_DIR}/redis_backup_${timestamp}.rdb"
    encrypted_file="${backup_file}.enc"
    metadata_file="${encrypted_file}.metadata"

    echo "Creating Redis backup: ${backup_file}"

    local redis_cli_args=("-h" "${REDIS_HOST}" "-p" "${REDIS_PORT}")

    if [[ -n "${REDIS_PASSWORD}" ]]; then
        redis_cli_args+=("-a" "${REDIS_PASSWORD}")
    fi

    # Method 1: Try SAVE command (blocks Redis, but ensures consistency)
    echo "Attempting Redis SAVE command..."
    if redis-cli "${redis_cli_args[@]}" SAVE >/dev/null 2>&1; then
        echo "Redis SAVE completed successfully"

        # Copy the RDB file from Redis data directory
        local redis_data_dir="/data"
        local redis_rdb_file="${redis_data_dir}/dump.rdb"

        if [[ -f "${redis_rdb_file}" ]]; then
            cp "${redis_rdb_file}" "${backup_file}"

            # Verify the backup file
            if [[ -s "${backup_file}" ]]; then
                echo "RDB file copied successfully: $(stat -f%z "${backup_file}" 2>/dev/null || stat -c%s "${backup_file}" 2>/dev/null || echo "0") bytes"
            else
                echo "ERROR: Backup file is empty or not created"
                exit 1
            fi
        else
            echo "ERROR: Redis RDB file not found after SAVE"
            exit 1
        fi
    else
        echo "Redis SAVE failed, trying alternative method..."

        # Method 2: Use BGSAVE (non-blocking background save)
        echo "Attempting Redis BGSAVE command..."
        if redis-cli "${redis_cli_args[@]}" BGSAVE >/dev/null 2>&1; then
            echo "Redis BGSAVE initiated"

            # Wait for BGSAVE to complete
            local attempts=0
            local max_attempts=30

            while [[ $attempts -lt $max_attempts ]]; do
                if [[ "$(redis-cli "${redis_cli_args[@]}" info persistence | grep rdb_bgsave_in_progress | cut -d: -f2)" == "0" ]]; then
                    break
                fi
                echo "Waiting for BGSAVE to complete... (attempt $((attempts + 1))/$max_attempts)"
                sleep 2
                attempts=$((attempts + 1))
            done

            if [[ $attempts -eq $max_attempts ]]; then
                echo "ERROR: BGSAVE did not complete within expected time"
                exit 1
            fi

            # Copy the RDB file
            local redis_data_dir="/data"
            local redis_rdb_file="${redis_data_dir}/dump.rdb"

            if [[ -f "${redis_rdb_file}" ]]; then
                cp "${redis_rdb_file}" "${backup_file}"
                echo "RDB file copied after BGSAVE"
            else
                echo "ERROR: Redis RDB file not found after BGSAVE"
                exit 1
            fi
        else
            echo "ERROR: Both SAVE and BGSAVE failed"
            echo "Attempting alternative: direct RDB file copy..."

            # Method 3: Direct file copy if RDB file exists
            local redis_data_dir="/data"
            local redis_rdb_file="${redis_data_dir}/dump.rdb"

            if [[ -f "${redis_rdb_file}" ]]; then
                cp "${redis_rdb_file}" "${backup_file}"
                echo "RDB file copied directly"
            else
                echo "ERROR: No RDB file found to backup"
                exit 1
            fi
        fi
    fi

    # Create additional backup using redis-cli --scan for key-value export
    create_key_value_backup "${timestamp}"

    # Compress and encrypt the main backup
    compress_and_encrypt_backup "${backup_file}" "${encrypted_file}"

    # Remove unencrypted backup file
    rm -f "${backup_file}"

    # Create metadata
    create_backup_metadata "${encrypted_file}" "${timestamp}" "${metadata_file}"

    echo "Redis backup completed: ${encrypted_file}"
}

# Create key-value backup as supplementary data
create_key_value_backup() {
    local timestamp="$1"
    local kv_backup_file="${BACKUP_DIR}/redis_kv_backup_${timestamp}.json"
    local kv_encrypted_file="${kv_backup_file}.enc"

    echo "Creating key-value backup..."

    local redis_cli_args=("-h" "${REDIS_HOST}" "-p" "${REDIS_PORT}")

    if [[ -n "${REDIS_PASSWORD}" ]]; then
        redis_cli_args+=("-a" "${REDIS_PASSWORD}")
    fi

    # Export all keys and their types to JSON
    {
        echo "{"
        echo "  \"export_timestamp\": \"$(date -Iseconds)\","
        echo "  \"redis_host\": \"${REDIS_HOST}\","
        echo "  \"redis_port\": \"${REDIS_PORT}\","
        echo "  \"database\": \"${REDIS_DB}\","
        echo "  \"keys\": {"

        local first=true
        local key_list
        key_list=$(redis-cli "${redis_cli_args[@]}" --scan)

        for key in ${key_list}; do
            if [[ "${first}" == "true" ]]; then
                first=false
            else
                echo ","
            fi

            local key_type
            key_type=$(redis-cli "${redis_cli_args[@]}" TYPE "${key}" 2>/dev/null || echo "unknown")

            printf "    \"%s\": {" "${key}"
            printf "\"type\": \"%s\"" "${key_type}"

            # Get value based on type
            case "${key_type}" in
                "string")
                    local value
                    value=$(redis-cli "${redis_cli_args[@]}" GET "${key}" 2>/dev/null | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
                    printf ", \"value\": \"%s\"" "${value}"
                    ;;
                "hash")
                    printf ", \"fields\": {"
                    local fields
                    local first_field=true
                    fields=$(redis-cli "${redis_cli_args[@]}" HKEYS "${key}" 2>/dev/null)
                    for field in ${fields}; do
                        if [[ "${first_field}" == "true" ]]; then
                            first_field=false
                        else
                            echo -n ", "
                        fi
                        local field_value
                        field_value=$(redis-cli "${redis_cli_args[@]}" HGET "${key}" "${field}" 2>/dev/null | sed 's/"/\\"/g')
                        printf "\"%s\": \"%s\"" "${field}" "${field_value}"
                    done
                    printf "}"
                    ;;
                "list")
                    printf ", \"values\": ["
                    local values
                    values=$(redis-cli "${redis_cli_args[@]}" LRANGE "${key}" 0 -1 2>/dev/null)
                    local first_value=true
                    for value in ${values}; do
                        if [[ "${first_value}" == "true" ]]; then
                            first_value=false
                        else
                            echo -n ", "
                        fi
                        printf "\"%s\"" "${value}"
                    done
                    printf "]"
                    ;;
                "set")
                    printf ", \"members\": ["
                    local members
                    members=$(redis-cli "${redis_cli_args[@]}" SMEMBERS "${key}" 2>/dev/null)
                    local first_member=true
                    for member in ${members}; do
                        if [[ "${first_member}" == "true" ]]; then
                            first_member=false
                        else
                            echo -n ", "
                        fi
                        printf "\"%s\"" "${member}"
                    done
                    printf "]"
                    ;;
                *)
                    printf ", \"value\": \"[binary data or unsupported type]\""
                    ;;
            esac

            printf "}"
        done

        echo ""
        echo "  }"
        echo "}"
    } > "${kv_backup_file}"

    # Encrypt the key-value backup
    if [[ -f "${kv_backup_file}" ]]; then
        compress_and_encrypt_backup "${kv_backup_file}" "${kv_encrypted_file}"
        rm -f "${kv_backup_file}"
        echo "Key-value backup completed: ${kv_encrypted_file}"
    fi
}

# Compress and encrypt backup file
compress_and_encrypt_backup() {
    local input_file="$1"
    local output_file="$2"

    echo "Compressing and encrypting backup file..."

    # First compress with gzip
    gzip -"${COMPRESSION_LEVEL}" "${input_file}"

    local compressed_file="${input_file}.gz"

    # Then encrypt
    if [[ ! -f "${ENCRYPTION_KEY_FILE}" ]]; then
        echo "ERROR: Encryption key file not found"
        exit 1
    fi

    openssl enc -aes-256-cbc \
        -salt \
        -in "${compressed_file}" \
        -out "${output_file}" \
        -pass file:"${ENCRYPTION_KEY_FILE}"

    # Set secure permissions
    chmod 600 "${output_file}"
    chown root:root "${output_file}"

    # Remove compressed file
    rm -f "${compressed_file}"

    echo "Backup compressed and encrypted successfully"
}

# Create backup metadata
create_backup_metadata() {
    local backup_file="$1"
    local timestamp="$2"
    local metadata_file="$3"

    local file_size
    file_size=$(stat -f%z "${backup_file}" 2>/dev/null || stat -c%s "${backup_file}" 2>/dev/null || echo "0")

    cat > "${metadata_file}" << EOF
{
    "backup_type": "redis",
    "timestamp": "$(date -Iseconds)",
    "redis_host": "${REDIS_HOST}",
    "redis_port": "${REDIS_PORT}",
    "database": "${REDIS_DB}",
    "size_bytes": ${file_size},
    "encrypted": true,
    "compression_level": "${COMPRESSION_LEVEL}",
    "retention_days": "${RETENTION_DAYS}",
    "checksum": "$(sha256sum "${backup_file}" | cut -d' ' -f1)",
    "backup_timestamp": "${timestamp}"
}
EOF

    chmod 600 "${metadata_file}"
    chown root:root "${metadata_file}"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"

    echo "Verifying backup integrity..."

    # Basic file checks
    if [[ ! -f "${backup_file}" ]]; then
        echo "ERROR: Backup file does not exist: ${backup_file}"
        return 1
    fi

    if [[ ! -s "${backup_file}" ]]; then
        echo "ERROR: Backup file is empty: ${backup_file}"
        return 1
    fi

    # Test decryption (basic check)
    local temp_file
    temp_file=$(mktemp)

    if ! openssl enc -aes-256-cbc -d \
        -in "${backup_file}" \
        -pass file:"${ENCRYPTION_KEY_FILE}" \
        -out "${temp_file}" >/dev/null 2>&1; then
        echo "ERROR: Backup file decryption failed: ${backup_file}"
        rm -f "${temp_file}"
        return 1
    fi

    # Check if decrypted file is a valid gzip file
    if ! gzip -t "${temp_file}" >/dev/null 2>&1; then
        echo "ERROR: Decrypted file is not a valid gzip archive: ${backup_file}"
        rm -f "${temp_file}"
        return 1
    fi

    rm -f "${temp_file}"
    echo "Backup verification successful: ${backup_file}"
    return 0
}

# Clean old backups
cleanup_old_backups() {
    echo "Cleaning up old Redis backups (older than ${RETENTION_DAYS} days)..."

    find "${BACKUP_DIR}" -name "*.enc" -type f -mtime +${RETENTION_DAYS} -delete

    # Keep only the latest backup for each day older than 7 days
    local temp_file
    temp_file=$(mktemp)

    find "${BACKUP_DIR}" -name "redis_backup_*.enc" -type f -printf '%T@ %p\n' | sort -n > "${temp_file}"

    awk '
    BEGIN { FS=" " }
    {
        if (match($2, /redis_backup_([0-9]{8})_([0-9]{6})\.rdb\.enc/, arr)) {
            date = arr[1]
            if (date in seen && systime() - $1 > 604800) {
                print $2
            }
            seen[date] = $1
        }
