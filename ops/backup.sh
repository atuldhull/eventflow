#!/bin/sh
# Daily backups (runs in the "backup" container of docker-compose.yml):
#   /backups/db-YYYY-MM-DD.sql.gz       full database dump (pg_dump)
#   /backups/uploads-YYYY-MM-DD.tar.gz  uploaded images and files
# Keeps BACKUP_KEEP_DAYS days (default 14). Copy /backups off the server too
# (e.g. rclone to Google Drive / S3 / R2), or a dead disk takes the backups with it.
#
# Restore the database:
#   gunzip -c db-2026-11-10.sql.gz | docker compose exec -T postgres psql -U eventflow -d eventflow
set -u
KEEP="${BACKUP_KEEP_DAYS:-14}"
mkdir -p /backups

backup() {
  day=$(date -u +%F)
  if pg_dump --no-owner --clean --if-exists | gzip > "/backups/db-$day.sql.gz.tmp"; then
    mv "/backups/db-$day.sql.gz.tmp" "/backups/db-$day.sql.gz"
    echo "$(date -u +%FT%TZ) database backup ok: db-$day.sql.gz ($(du -h "/backups/db-$day.sql.gz" | cut -f1))"
  else
    rm -f "/backups/db-$day.sql.gz.tmp"
    echo "$(date -u +%FT%TZ) DATABASE BACKUP FAILED" >&2
  fi
  if [ -d /uploads ]; then
    tar -czf "/backups/uploads-$day.tar.gz" -C /uploads . && echo "$(date -u +%FT%TZ) uploads backup ok"
  fi
  find /backups -name 'db-*.sql.gz' -mtime +"$KEEP" -delete
  find /backups -name 'uploads-*.tar.gz' -mtime +"$KEEP" -delete
}

backup
while true; do
  sleep 86400
  backup
done
