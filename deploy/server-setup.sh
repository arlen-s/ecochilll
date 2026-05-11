#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-ancientherbs.ac.cn}"
WEB_ROOT="/var/www/${DOMAIN}"
CURRENT_DIR="${WEB_ROOT}/current"
ARCHIVE_PATH="${2:-/tmp/${DOMAIN}-dist.tar.gz}"
NGINX_CONF_SRC="${3:-./deploy/ancientherbs.ac.cn.conf}"
NGINX_CONF_TARGET="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_ENABLED_TARGET="/etc/nginx/sites-enabled/${DOMAIN}.conf"

if [[ ! -f "${ARCHIVE_PATH}" ]]; then
  echo "Archive not found: ${ARCHIVE_PATH}" >&2
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx
fi

mkdir -p "${CURRENT_DIR}"
find "${CURRENT_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf "${ARCHIVE_PATH}" -C "${CURRENT_DIR}"

if [[ -f "${NGINX_CONF_SRC}" ]]; then
  cp "${NGINX_CONF_SRC}" "${NGINX_CONF_TARGET}"
else
  echo "Nginx config not found: ${NGINX_CONF_SRC}" >&2
  exit 1
fi

ln -sf "${NGINX_CONF_TARGET}" "${NGINX_ENABLED_TARGET}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "Deployment completed for ${DOMAIN}"
echo "Web root: ${CURRENT_DIR}"
