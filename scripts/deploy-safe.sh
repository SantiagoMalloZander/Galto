#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="galto-frontend"
PORT="3000"
HOST="127.0.0.1"
TS="$(date +%s)"
BACKUP_DIR="${APP_DIR}/.next_backup_${TS}"

cd "${APP_DIR}"

echo "[deploy-safe] Stopping ${APP_NAME}..."
pm2 stop "${APP_NAME}" >/dev/null 2>&1 || true

if [ -d ".next" ]; then
  echo "[deploy-safe] Backing up current build to ${BACKUP_DIR}"
  mv ".next" "${BACKUP_DIR}"
fi

echo "[deploy-safe] Building app..."
if ! npm run build; then
  echo "[deploy-safe] Build failed. Restoring previous build..."
  rm -rf ".next"
  if [ -d "${BACKUP_DIR}" ]; then
    mv "${BACKUP_DIR}" ".next"
  fi
  echo "[deploy-safe] Starting previous version..."
  pm2 start "${APP_NAME}" >/dev/null 2>&1 || pm2 start /usr/bin/bash --name "${APP_NAME}" -- -c "pnpm exec next start -H ${HOST} -p ${PORT}"
  pm2 save >/dev/null
  exit 1
fi

echo "[deploy-safe] Starting ${APP_NAME}..."
pm2 start "${APP_NAME}" >/dev/null 2>&1 || pm2 start /usr/bin/bash --name "${APP_NAME}" -- -c "pnpm exec next start -H ${HOST} -p ${PORT}"
pm2 save >/dev/null

echo "[deploy-safe] Health check..."
sleep 1
curl -fsS --max-time 8 "http://${HOST}:${PORT}/" >/dev/null

echo "[deploy-safe] OK. Cleaning old backups..."
ls -dt .next_backup_* .next_bak_* .next_corrupt_* 2>/dev/null | xargs -r rm -rf
if [ -d "${BACKUP_DIR}" ]; then
  rm -rf "${BACKUP_DIR}"
fi

echo "[deploy-safe] Done."
