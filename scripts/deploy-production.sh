#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
env_file="${CTMS_ENV_FILE:-$project_root/.env.production}"
action="${1:-help}"
compose_files=(-f docker-compose.yml -f docker-compose.prod.yml)

usage() {
  cat <<'USAGE'
Usage: bash scripts/deploy-production.sh <command>

  build           Build CTMS images only (uses shared VPS CPU/RAM).
  deploy          Start/update CTMS using already-built images; never build implicitly.
  release         Pull and deploy registry images for CTMS_IMAGE_NAMESPACE and CTMS_IMAGE_TAG.
  config          Validate production Compose configuration without secrets output.

Shared VPS mode: Compose project ditrek-prod, private containers/network/volumes.
Only 127.0.0.1:18080 is bound by default (override with CTMS_HTTP_PORT).
Host ports 80/443, host web servers and certificate services are not managed.
Public HTTPS/domain routing must be configured separately, for example via a tunnel.
Requires .env.production and Docker Compose >= 2.24.4.
USAGE
}

case "$action" in
  help|-h|--help) usage; exit 0 ;;
  init|renew)
    echo "Automatic HTTPS setup/renewal is disabled on this shared VPS. Do not change services on ports 80/443." >&2
    echo "Use 'build' explicitly after checking resources, then 'deploy'. Public HTTPS requires separate tunnel/routing setup." >&2
    exit 1
    ;;
  build|deploy|config) ;;
  release) compose_files+=(-f docker-compose.registry.yml) ;;
  *) usage >&2; exit 1 ;;
esac

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Create it on the VPS with your production database credentials and API keys." >&2
  exit 1
fi

compose() {
  docker compose -p ditrek-prod --env-file "$env_file" \
    "${compose_files[@]}" "$@"
}

compose config --quiet

start_production() {
  compose up -d --no-build --wait postgres redis api basemap-worker ai ingestion web
  # Recreate Nginx to pick up bind-mounted configuration replaced by git checkout.
  compose up -d --no-build --wait --no-deps --force-recreate nginx
  compose exec -T nginx nginx -t
  echo "CTMS private gateway: http://$(compose port nginx 80)"
  echo "Public HTTPS/domain routing is separate and has not been configured by this script."
}

case "$action" in
  config)
    echo "Production Compose configuration is valid."
    ;;
  build)
    compose build
    ;;
  deploy)
    start_production
    ;;
  release)
    compose pull --policy missing postgres redis nginx
    compose pull --policy always api web ai ingestion
    start_production
    ;;
esac
