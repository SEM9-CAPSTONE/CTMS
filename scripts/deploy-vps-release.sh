#!/usr/bin/env bash
set -euo pipefail

commit="${1:?Missing commit SHA}"
namespace="${2:?Missing Docker Hub namespace}"
release_id="${3:?Missing workflow run and attempt}"

if ! [[ "$commit" =~ ^[a-f0-9]{40}$ && "$namespace" =~ ^[a-z0-9][a-z0-9_-]*$ && "$release_id" =~ ^[0-9]+-[0-9]+$ ]]; then
  echo 'Invalid release identifier or Docker Hub namespace.' >&2
  exit 1
fi

umask 077
environment="${4:-production}"
case "$environment" in
  production)
    release_root="$HOME/.ctms-ci"
    bundle="$release_root/$release_id.tar"
    CTMS_ENV_FILE=/srv/apps/ctms/.env.production
    CTMS_IMAGE_TAG="$commit"
    release_command=(scripts/deploy-production.sh release)
    ;;
  dev)
    release_root="$HOME/.ctms-dev-ci"
    bundle="$release_root/$release_id.tar.gz"
    CTMS_ENV_FILE="$HOME/ctms-dev/.env.dev"
    CTMS_IMAGE_TAG="dev-$commit"
    release_command=(scripts/deploy-dev.sh)
    ;;
  *)
    echo 'Expected deployment environment production or dev.' >&2
    exit 1
    ;;
esac

release_dir="$release_root/releases/$commit"
export CTMS_ENV_FILE CTMS_IMAGE_TAG
export CTMS_IMAGE_NAMESPACE="$namespace"

staging_dir=''
cleanup() {
  if [[ -n "$staging_dir" ]]; then
    rm -rf -- "$staging_dir"
  fi
  rm -f -- "$bundle"
}
trap cleanup EXIT

if [[ ! -r "$CTMS_ENV_FILE" ]]; then
  echo "The deployment user must be able to read $CTMS_ENV_FILE." >&2
  exit 1
fi

exec 9>"$release_root/deploy.lock"
flock -w 300 9

if [[ "$environment" == 'dev' ]]; then
  mkdir -p -- "$release_root/releases"
  if [[ -d "$release_dir" ]]; then
    release_dir="$release_root/releases/${commit}-${release_id}"
  fi
  staging_dir=$(mktemp -d "$release_root/releases/.incoming.XXXXXXXX")
  tar -xzf "$bundle" -C "$staging_dir"
  if [[ -d "$staging_dir/mobile-web" ]]; then
    chmod -R a+rX -- "$staging_dir/mobile-web"
  fi
  mv -- "$staging_dir" "$release_dir"
  staging_dir=''
elif [[ ! -d "$release_dir" ]]; then
  mkdir -p -- "$release_root/releases"
  staging_dir=$(mktemp -d "$release_root/releases/.incoming.XXXXXXXX")
  tar -xf "$bundle" -C "$staging_dir"
  mv -- "$staging_dir" "$release_dir"
  staging_dir=''
fi

cd "$release_dir"
bash "${release_command[@]}"

if [[ "$environment" == 'dev' ]]; then
  # Keep the 5 newest dev releases (always preserving the active release_dir) to bound disk usage.
  mapfile -t old_releases < <(
    find "$release_root/releases" -mindepth 1 -maxdepth 1 -type d ! -name '.incoming.*' -printf '%T@ %p\n' \
      | sort -rn \
      | tail -n +6 \
      | cut -d' ' -f2-
  )
  for old_release in "${old_releases[@]}"; do
    if [[ -n "$old_release" && "$old_release" != "$release_dir" ]]; then
      rm -rf -- "$old_release"
    fi
  done
fi
