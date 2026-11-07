#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
env_file="${CTMS_ENV_FILE:-$project_root/.env.production}"
# Only the first-certificate step may select the HTTP bootstrap configuration.
export CTMS_NGINX_CONFIG=./infra/nginx/production.conf
action="${1:-help}"
if [[ $# -gt 0 ]]; then shift; fi

usage() {
  cat <<'USAGE'
Usage: bash scripts/deploy-production.sh <command>

  init EMAIL      Build CTMS, obtain HTTPS certificates, and start production.
  deploy          Rebuild and start production using existing certificates.
  renew [OPTIONS] Renew certificates and reload Nginx (accepts --dry-run).
  config          Validate production Compose configuration without secrets output.

Requires .env.production, Docker Compose >= 2.24.4, and ports 80/443 available.
Before init, point BOTH ditrek.io.vn and www.ditrek.io.vn to this VPS.
USAGE
}

case "$action" in
  help|-h|--help) usage; exit 0 ;;
  init|deploy|renew|config) ;;
  *) usage >&2; exit 1 ;;
esac

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Create it on the VPS with your production database credentials and API keys." >&2
  exit 1
fi

compose() {
  docker compose --env-file "$env_file" \
    -f docker-compose.yml -f docker-compose.prod.yml "$@"
}

compose config --quiet

has_certificate() {
  compose run --rm --no-deps --entrypoint sh certbot -c \
    'test -s /etc/letsencrypt/live/ditrek.io.vn/fullchain.pem && test -s /etc/letsencrypt/live/ditrek.io.vn/privkey.pem'
}

start_production() {
  # Explicitly stop Adminer if a previous development deployment started it.
  compose stop adminer
  compose up -d --wait postgres redis api ai ingestion web
  # Recreate Nginx to pick up bind-mounted configuration replaced by git checkout.
  compose up -d --wait --no-deps --force-recreate nginx
  compose exec -T nginx nginx -t
  echo "CTMS is running at https://ditrek.io.vn"
}

case "$action" in
  config)
    echo "Production Compose configuration is valid."
    ;;
  init)
    email="${1:-}"
    if [[ -z "$email" || "$email" != *@* ]]; then
      echo "Usage: bash scripts/deploy-production.sh init EMAIL" >&2
      exit 1
    fi
    compose build
    if ! has_certificate; then
      CTMS_NGINX_CONFIG=./infra/nginx/bootstrap.conf compose up -d --wait --no-deps nginx
    fi
    compose run --rm --no-deps certbot certonly \
      --webroot --webroot-path /var/www/certbot \
      --non-interactive --agree-tos --keep-until-expiring --email "$email" \
      --cert-name ditrek.io.vn -d ditrek.io.vn -d www.ditrek.io.vn
    start_production
    ;;
  deploy)
    if ! has_certificate; then
      echo "No HTTPS certificate found. Run: bash scripts/deploy-production.sh init EMAIL" >&2
      exit 1
    fi
    compose build
    start_production
    ;;
  renew)
    compose run --rm --no-deps certbot renew \
      --webroot --webroot-path /var/www/certbot "$@"
    compose exec -T nginx nginx -t
    compose exec -T nginx nginx -s reload
    ;;
esac
