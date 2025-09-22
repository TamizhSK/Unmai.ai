#!/bin/bash

# Quick deploy script for Unmai.ai
# Usage: ./scripts/deploy.sh [project-id] [region]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ID=${1:-"helpful-cat-465008-h1"}
REGION=${2:-"us-central1"}

echo -e "${GREEN}🚀 Deploying Unmai.ai to Cloud Run${NC}"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Check if we're in the right directory
if [ ! -f "cloudbuild.yaml" ]; then
    echo -e "${RED}❌ cloudbuild.yaml not found. Please run from project root.${NC}"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

# Deploy using Cloud Build
echo -e "${YELLOW}📦 Submitting build to Cloud Build...${NC}"
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions _REGION=$REGION,_FRONTEND_SERVICE=unmai-frontend,_BACKEND_SERVICE=unmai-backend

echo -e "${GREEN}✅ Deployment complete!${NC}"

# Get service URLs
echo -e "${YELLOW}🔗 Service URLs:${NC}"
BACKEND_URL=$(gcloud run services describe unmai-backend --region $REGION --format='value(status.url)' 2>/dev/null || echo "Not deployed")
FRONTEND_URL=$(gcloud run services describe unmai-frontend --region $REGION --format='value(status.url)' 2>/dev/null || echo "Not deployed")

echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"

if [ "$FRONTEND_URL" != "Not deployed" ]; then
    echo -e "${GREEN}🎉 Your app is live at: $FRONTEND_URL${NC}"
fi
