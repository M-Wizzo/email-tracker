#!/usr/bin/env bash
set -euo pipefail
VPS=185.176.8.116

# Sube solo código (sin node_modules ni .next)
rsync -az --delete --exclude node_modules --exclude .next \
  backend/  root@$VPS:/var/www/email-tracker/backend/
rsync -az --delete --exclude node_modules --exclude .next \
  frontend/ root@$VPS:/var/www/email-tracker/frontend/

# Instala y build en el VPS
ssh root@$VPS "
  set -e
  chown -R www-data:www-data /var/www/email-tracker
  sudo -u www-data npm --prefix /var/www/email-tracker/backend ci
  sudo -u www-data npm --prefix /var/www/email-tracker/frontend ci
  sudo -u www-data npm --prefix /var/www/email-tracker/frontend run build
  systemctl restart email-tracker-backend
  systemctl restart email-tracker-frontend
  systemctl status --no-pager email-tracker-backend | sed -n '1,12p'
"
echo "✅ Deploy PROD listo"
