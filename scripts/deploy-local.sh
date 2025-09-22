#!/bin/bash

# Local deployment script for testing
# This script builds and deploys your app locally for testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}

echo -e "${GREEN}🚀 Starting local deployment to Cloud Run${NC}"

# Build and submit to Cloud Build
echo -e "${YELLOW}🏗️ Building and deploying to Cloud Run...${NC}"
gcloud builds submit \
    --config cloudbuild.yaml \
    --project $PROJECT_ID \
    --substitutions _REGION=$REGION,_FRONTEND_SERVICE=unmai-frontend,_BACKEND_SERVICE=unmai-backend

# Get service URLs
echo -e "${YELLOW}🔍 Getting service URLs...${NC}"
FRONTEND_URL=$(gcloud run services describe unmai-frontend --region $REGION --project $PROJECT_ID --format='value(status.url)')
BACKEND_URL=$(gcloud run services describe unmai-backend --region $REGION --project $PROJECT_ID --format='value(status.url)')

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo
echo -e "${YELLOW}🌐 Service URLs:${NC}"
echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"
echo
echo -e "${YELLOW}📊 Monitor your services:${NC}"
echo "Frontend logs: gcloud logs tail --follow --project=$PROJECT_ID --format='value(textPayload)' --filter='resource.labels.service_name=unmai-frontend'"
echo "Backend logs: gcloud logs tail --follow --project=$PROJECT_ID --format='value(textPayload)' --filter='resource.labels.service_name=unmai-backend'"
