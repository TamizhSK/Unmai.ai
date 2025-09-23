#!/bin/bash

# Setup script for Unmai.ai deployment on Google Cloud Platform
# This script sets up the necessary GCP services and secrets

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${1:-"helpful-cat-465008-h1"}
REGION=${2:-"us-central1"}
FRONTEND_SERVICE="unmai-frontend"
BACKEND_SERVICE="unmai-backend"

echo -e "${GREEN}🚀 Setting up Unmai.ai deployment environment${NC}"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW} Not authenticated with gcloud. Please run: gcloud auth login${NC}"
    exit 1
fi

# Set the project
echo -e "${YELLOW}📋 Setting project to $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Create Artifact Registry repository (recommended over Container Registry)
echo -e "${YELLOW}🏗️ Creating Artifact Registry repository...${NC}"
gcloud artifacts repositories create unmai-repo \
    --repository-format=docker \
    --location=$REGION \
    --description="Unmai.ai Docker repository" || echo "Repository might already exist"

# Set up Secret Manager for sensitive data
echo -e "${YELLOW}🔐 Setting up Secret Manager...${NC}"

# Check if Gemini API key secret exists
if ! gcloud secrets describe gemini-api-key >/dev/null 2>&1; then
    echo -e "${YELLOW}Please enter your Gemini API key:${NC}"
    read -s GEMINI_API_KEY
    echo "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
    echo -e "${GREEN}  Gemini API key stored in Secret Manager${NC}"
else
    echo -e "${GREEN}  Gemini API key secret already exists${NC}"
fi

# Grant Cloud Build access to secrets
echo -e "${YELLOW}🔑 Setting up IAM permissions...${NC}"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
CLOUD_BUILD_SA="$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"

# Grant necessary roles to Cloud Build service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CLOUD_BUILD_SA" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CLOUD_BUILD_SA" \
    --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CLOUD_BUILD_SA" \
    --role="roles/secretmanager.secretAccessor"

# Set up Workload Identity for GitHub Actions (optional but recommended)
echo -e "${YELLOW}🔗 Setting up Workload Identity Federation for GitHub Actions...${NC}"
read -p "Do you want to set up GitHub Actions integration? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your GitHub repository (format: owner/repo): " GITHUB_REPO
    
    # Create Workload Identity Pool
    gcloud iam workload-identity-pools create "github-pool" \
        --project="$PROJECT_ID" \
        --location="global" \
        --display-name="GitHub Actions Pool" || echo "Pool might already exist"
    
    # Create Workload Identity Provider
    gcloud iam workload-identity-pools providers create-oidc "github-provider" \
        --project="$PROJECT_ID" \
        --location="global" \
        --workload-identity-pool="github-pool" \
        --display-name="GitHub Actions Provider" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
        --issuer-uri="https://token.actions.githubusercontent.com" || echo "Provider might already exist"
    
    # Create service account for GitHub Actions
    gcloud iam service-accounts create github-actions \
        --project="$PROJECT_ID" \
        --display-name="GitHub Actions Service Account" || echo "Service account might already exist"
    
    # Grant necessary permissions
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
        --role="roles/cloudbuild.builds.editor"
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
        --role="roles/run.viewer"
    
    # Allow GitHub Actions to impersonate the service account
    gcloud iam service-accounts add-iam-policy-binding \
        --project="$PROJECT_ID" \
        --role="roles/iam.workloadIdentityUser" \
        --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$GITHUB_REPO" \
        "github-actions@$PROJECT_ID.iam.gserviceaccount.com"
    
    echo -e "${GREEN}  Workload Identity Federation configured${NC}"
    echo -e "${YELLOW}📝 Add these secrets to your GitHub repository:${NC}"
    echo "GCP_PROJECT_ID: $PROJECT_ID"
    echo "WIF_PROVIDER: projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
    echo "WIF_SERVICE_ACCOUNT: github-actions@$PROJECT_ID.iam.gserviceaccount.com"
fi

echo -e "${GREEN}🎉 Deployment environment setup complete!${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update your cloudbuild.yaml with your project-specific values"
echo "2. Commit and push your code to trigger the GitHub Actions workflow"
echo "3. Monitor your deployment in the Google Cloud Console"
echo
echo -e "${YELLOW}To deploy manually:${NC}"
echo "gcloud builds submit --config cloudbuild.yaml"
