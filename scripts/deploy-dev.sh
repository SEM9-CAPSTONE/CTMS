#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
env_file="${CTMS_ENV_FILE:?Set CTMS_ENV_FILE to the dev environment file}"

if [[ ! -f "$project_root/mobile-web/index.html" ]]; then
  echo "Missing Flutter Web PWA bundle at $project_root/mobile-web/index.html." >&2
  exit 1
fi
chmod -R a+rX -- "$project_root/mobile-web"

image_env=$(mktemp)
trap 'rm -f -- "$image_env"' EXIT
printf 'CTMS_IMAGE_NAMESPACE=%s\nCTMS_IMAGE_TAG=%s\nCTMS_MOBILE_WEB_DIR=%s\n' \
  "${CTMS_IMAGE_NAMESPACE:?Set CTMS_IMAGE_NAMESPACE}" \
  "${CTMS_IMAGE_TAG:?Set CTMS_IMAGE_TAG}" \
  "$project_root/mobile-web" > "$image_env"

compose() {
  sudo -n docker compose -p ditrek-dev --env-file "$env_file" --env-file "$image_env" \
    -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.dev.yml \
    -f docker-compose.registry.yml "$@"
}

prune_unused_docker_cache() {
  # Removes images not referenced by any container and unused build cache; volumes are untouched.
  sudo -n docker image prune -af || echo "Warning: docker image prune failed." >&2
  sudo -n docker builder prune -af || echo "Warning: docker builder prune failed." >&2
}

compose config --quiet
prune_unused_docker_cache
compose pull --policy missing postgres redis nginx caddy
compose pull --policy always api web ai ingestion
compose up -d --no-build --wait --wait-timeout 300
compose exec -T nginx nginx -t
compose exec -T --user nginx nginx test -r /usr/share/nginx/html/mobile/index.html
compose exec -T nginx nginx -s reload
prune_unused_docker_cache
