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
release_root="$HOME/.ctms-ci"
bundle="$release_root/$release_id.tar"
release_dir="$release_root/releases/$commit"
export CTMS_ENV_FILE=/srv/apps/ctms/.env.production
export CTMS_IMAGE_NAMESPACE="$namespace"
export CTMS_IMAGE_TAG="$commit"

trap 'rm -f -- "$bundle"' EXIT
if [[ ! -r "$CTMS_ENV_FILE" ]]; then
  echo "The deployment user must be able to read $CTMS_ENV_FILE." >&2
  exit 1
fi

exec 9>"$release_root/deploy.lock"
flock -w 300 9
if [[ ! -d "$release_dir" ]]; then
  mkdir -p -- "$release_root/releases"
  staging_dir=$(mktemp -d "$release_root/releases/.incoming.XXXXXXXX")
  trap 'rm -rf -- "$staging_dir"; rm -f -- "$bundle"' EXIT
  tar -xf "$bundle" -C "$staging_dir"
  mv -- "$staging_dir" "$release_dir"
fi

bash "$release_dir/scripts/deploy-production.sh" release
