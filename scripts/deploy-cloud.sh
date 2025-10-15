#!/bin/bash

# Lightweight Cloud Run deployment helper for Unmai.ai
# Wraps the Cloud Build submission used in CI/CD with basic safety checks.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required but not installed" >&2
  exit 1
fi

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID environment variable is not set and no default gcloud project found." >&2
  echo "Run 'gcloud config set project <PROJECT_ID>' or export PROJECT_ID before retrying." >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-unmai-frontend}"
BACKEND_SERVICE="${BACKEND_SERVICE:-unmai-backend}"
ARTIFACT_REGISTRY="${ARTIFACT_REGISTRY:-us-central1-docker.pkg.dev}"
REPOSITORY="${REPOSITORY:-unmai-repo}"

printf 'Deploying Unmai.ai via Cloud Build\n'
printf '  Project: %s\n' "$PROJECT_ID"
printf '  Region: %s\n' "$REGION"
printf '  Frontend service: %s\n' "$FRONTEND_SERVICE"
printf '  Backend service: %s\n' "$BACKEND_SERVICE"

pushd "$PROJECT_ROOT" >/dev/null

gcloud builds submit \
  --config cloudbuild-minimal.yaml \
  --substitutions "_REGION=${REGION},_FRONTEND_SERVICE=${FRONTEND_SERVICE},_BACKEND_SERVICE=${BACKEND_SERVICE},_ARTIFACT_REGISTRY=${ARTIFACT_REGISTRY},_REPOSITORY=${REPOSITORY}" \
  --project "$PROJECT_ID"

popd >/dev/null

printf '\nDeployment request submitted. Monitor progress in Cloud Build or run:\n'
printf '  gcloud builds log --stream --project %s $(gcloud builds list --project %s --limit=1 --format="value(ID)")\n' "$PROJECT_ID" "$PROJECT_ID"
