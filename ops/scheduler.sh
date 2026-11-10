#!/bin/sh
# EventFlow's scheduled jobs (runs in the "scheduler" container of docker-compose.yml):
#   every 5 minutes  /api/cron/release-holds  gives back seats of checkouts nobody paid
#   every hour       /api/cron/reminders      sends event reminder emails
# Needs APP_URL (e.g. http://app:3000) and CRON_SECRET.
set -u
: "${APP_URL:?set APP_URL}"
: "${CRON_SECRET:?set CRON_SECRET}"

call() {
  out=$(wget -q -T 60 -O - --header "Authorization: Bearer $CRON_SECRET" "$APP_URL$1" 2>&1)
  echo "$(date -u +%FT%TZ) $1 $(echo "$out" | head -c 300)"
}

tick=0
while true; do
  call /api/cron/release-holds
  if [ $((tick % 12)) -eq 0 ]; then call /api/cron/reminders; fi
  tick=$((tick + 1))
  sleep 300
done
