#!/usr/bin/env bash
set -euo pipefail

# Copies docker-compose.bifrost.yml from this repo into the IRIS deploy directory.
# Default layout on the VPS: ~/chatbotx-src (git) + ~/chatbotx (compose).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_DIR="${CHATBOTX_DEPLOY_DIR:-${HOME}/chatbotx}"
SOURCE_FILE="${REPO_ROOT}/docker-compose.bifrost.yml"
TARGET_FILE="${DEPLOY_DIR}/docker-compose.bifrost.yml"

if [[ ! -f "${SOURCE_FILE}" ]]; then
  echo "Missing ${SOURCE_FILE}" >&2
  exit 1
fi

mkdir -p "${DEPLOY_DIR}"
cp "${SOURCE_FILE}" "${TARGET_FILE}"
echo "Synced ${TARGET_FILE}"
