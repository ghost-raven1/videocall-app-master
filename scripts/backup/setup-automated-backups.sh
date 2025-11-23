#!/bin/bash
# scripts/backup/setup-automated-backups.sh - Setup automated scheduled backups

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="/backups"
CRON_LOG="/var/log/videocall-backup/cron.log"

echo "🔧 Setting up automated backups..."

# Create backup directories
mkdir -p "${BACKUP_ROOT}/postgresql/daily" "${BACKUP_ROOT}/redis/daily" "/var/log/videocall-backup"
chmod 750 "${BACKUP_ROOT}"

# Create cron job for PostgreSQL backup (daily at 2 AM)
POSTGRES_CRON="0 2 * * * ${SCRIPT_DIR}/postgresql/backup_postgresql.sh >> ${CRON_LOG} 2>&1"

# Create cron job for Redis backup (daily at 2:30 AM)
REDIS_CRON="30 2 * * * ${SCRIPT_DIR}/redis/backup_redis.sh >> ${CRON_LOG} 2>&1"

# Check if cron jobs already exist
if crontab -l 2>/dev/null | grep -q "backup_postgresql.sh"; then
    echo "⚠️  PostgreSQL backup cron job already exists"
else
    (crontab -l 2>/dev/null; echo "${POSTGRES_CRON}") | crontab -
    echo "✅ PostgreSQL backup cron job added"
fi

if crontab -l 2>/dev/null | grep -q "backup_redis.sh"; then
    echo "⚠️  Redis backup cron job already exists"
else
    (crontab -l 2>/dev/null; echo "${REDIS_CRON}") | crontab -
    echo "✅ Redis backup cron job added"
fi

# For Kubernetes: Create CronJob manifests
cat > "${SCRIPT_DIR}/../k8s/backup-cronjob.yaml" << 'EOF'
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgresql-backup
  namespace: videocall-production
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgresql-backup
            image: postgres:15-alpine
            command:
            - /bin/bash
            - -c
            - |
              PGPASSWORD=${POSTGRES_PASSWORD} pg_dump -h ${DB_HOST} -U ${POSTGRES_USER} ${POSTGRES_DB} > /backups/postgresql/daily/backup_$(date +%Y%m%d_%H%M%S).sql
            env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: POSTGRES_PASSWORD
            - name: DB_HOST
              value: "postgres"
            - name: POSTGRES_USER
              value: "postgres"
            - name: POSTGRES_DB
              value: "videocall_db"
            volumeMounts:
            - name: backup-storage
              mountPath: /backups
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-storage
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: redis-backup
  namespace: videocall-production
spec:
  schedule: "30 2 * * *"  # Daily at 2:30 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: redis-backup
            image: redis:7-alpine
            command:
            - /bin/sh
            - -c
            - |
              redis-cli -h ${REDIS_HOST} SAVE
              cp /data/dump.rdb /backups/redis/daily/dump_$(date +%Y%m%d_%H%M%S).rdb
            env:
            - name: REDIS_HOST
              value: "redis"
            volumeMounts:
            - name: redis-data
              mountPath: /data
            - name: backup-storage
              mountPath: /backups
          restartPolicy: OnFailure
          volumes:
          - name: redis-data
            persistentVolumeClaim:
              claimName: redis-data
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-storage
EOF

echo ""
echo "✅ Automated backups setup completed!"
echo ""
echo "📋 Cron jobs installed:"
crontab -l | grep -E "backup_postgresql|backup_redis" || echo "  (No cron jobs found - check manually)"
echo ""
echo "📁 Kubernetes CronJob manifest created:"
echo "  ${SCRIPT_DIR}/../k8s/backup-cronjob.yaml"
echo ""
echo "🚀 To apply Kubernetes CronJobs:"
echo "  kubectl apply -f ${SCRIPT_DIR}/../k8s/backup-cronjob.yaml"

