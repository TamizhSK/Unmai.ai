#!/bin/bash

# GCP Secret Manager Setup for Unmai.ai
# Creates and manages secrets for secure environment variable handling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${CYAN}$1${NC}"; }

print_header "🔐 GCP Secret Manager Setup for Unmai.ai"
print_header "========================================="

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed. Please install it first."
    print_status "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 > /dev/null; then
    print_error "Not authenticated with gcloud. Please run: gcloud auth login"
    exit 1
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    print_error "No GCP project set. Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

print_status "Using GCP project: $PROJECT_ID"

# Enable required APIs
print_status "Enabling required GCP APIs..."
gcloud services enable secretmanager.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable artifactregistry.googleapis.com --quiet
print_success "Required APIs enabled"

# Function to create or update a secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    if gcloud secrets describe "$secret_name" --quiet 2>/dev/null; then
        print_status "Updating existing secret: $secret_name"
        echo "$secret_value" | gcloud secrets versions add "$secret_name" --data-file=-
    else
        print_status "Creating new secret: $secret_name"
        echo "$secret_value" | gcloud secrets create "$secret_name" \
            --data-file=- \
            --labels=app=unmai,environment=production \
            --quiet
    fi
    
    print_success "Secret '$secret_name' configured"
}

# Function to validate API key format
validate_gemini_api_key() {
    local api_key=$1
    if [[ ! "$api_key" =~ ^AIza[0-9A-Za-z_-]{35}$ ]]; then
        print_warning "API key format may be invalid. Expected format: AIza[35 characters]"
        return 1
    fi
    return 0
}

# Setup GEMINI_API_KEY
print_header "Setting up GEMINI_API_KEY"
if [ -n "$GEMINI_API_KEY" ]; then
    print_status "Using GEMINI_API_KEY from environment"
    if validate_gemini_api_key "$GEMINI_API_KEY"; then
        create_or_update_secret "gemini-api-key" "$GEMINI_API_KEY" "Gemini API key for AI services"
    else
        print_error "Invalid GEMINI_API_KEY format. Please check your API key."
        exit 1
    fi
elif [ -f ".env" ] && grep -q "GEMINI_API_KEY" .env; then
    print_status "Reading GEMINI_API_KEY from .env file"
    GEMINI_API_KEY=$(grep "GEMINI_API_KEY" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$GEMINI_API_KEY" ] && validate_gemini_api_key "$GEMINI_API_KEY"; then
        create_or_update_secret "gemini-api-key" "$GEMINI_API_KEY" "Gemini API key for AI services"
    else
        print_error "Invalid or missing GEMINI_API_KEY in .env file"
        exit 1
    fi
else
    print_error "GEMINI_API_KEY not found in environment or .env file"
    print_status "Please set it with: export GEMINI_API_KEY='your_api_key'"
    print_status "Or add it to your .env file: GEMINI_API_KEY=your_api_key"
    exit 1
fi

# Setup optional GOOGLE_CUSTOM_SEARCH_API_KEY
print_header "Setting up Google Custom Search API Key (Optional)"
if [ -n "$GOOGLE_CUSTOM_SEARCH_API_KEY" ]; then
    print_status "Using GOOGLE_CUSTOM_SEARCH_API_KEY from environment"
    create_or_update_secret "google-custom-search-api-key" "$GOOGLE_CUSTOM_SEARCH_API_KEY" "Google Custom Search API key"
elif [ -f ".env" ] && grep -q "GOOGLE_CUSTOM_SEARCH_API_KEY" .env; then
    print_status "Reading GOOGLE_CUSTOM_SEARCH_API_KEY from .env file"
    GOOGLE_CUSTOM_SEARCH_API_KEY=$(grep "GOOGLE_CUSTOM_SEARCH_API_KEY" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$GOOGLE_CUSTOM_SEARCH_API_KEY" ]; then
        create_or_update_secret "google-custom-search-api-key" "$GOOGLE_CUSTOM_SEARCH_API_KEY" "Google Custom Search API key"
    fi
else
    print_warning "GOOGLE_CUSTOM_SEARCH_API_KEY not found (optional)"
    print_status "You can add it later with: gcloud secrets create google-custom-search-api-key --data-file=<(echo 'your_key')"
fi

# Setup optional GOOGLE_SEARCH_ENGINE_ID
print_header "Setting up Google Search Engine ID (Optional)"
if [ -n "$GOOGLE_SEARCH_ENGINE_ID" ]; then
    print_status "Using GOOGLE_SEARCH_ENGINE_ID from environment"
    create_or_update_secret "google-search-engine-id" "$GOOGLE_SEARCH_ENGINE_ID" "Google Custom Search Engine ID"
elif [ -f ".env" ] && grep -q "GOOGLE_SEARCH_ENGINE_ID" .env; then
    print_status "Reading GOOGLE_SEARCH_ENGINE_ID from .env file"
    GOOGLE_SEARCH_ENGINE_ID=$(grep "GOOGLE_SEARCH_ENGINE_ID" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$GOOGLE_SEARCH_ENGINE_ID" ]; then
        create_or_update_secret "google-search-engine-id" "$GOOGLE_SEARCH_ENGINE_ID" "Google Custom Search Engine ID"
    fi
else
    print_warning "GOOGLE_SEARCH_ENGINE_ID not found (optional)"
    print_status "You can add it later with: gcloud secrets create google-search-engine-id --data-file=<(echo 'your_id')"
fi

# IAM permissions will be handled automatically by Cloud Run
print_header "IAM Permissions"
print_status "IAM permissions will be configured automatically during Cloud Run deployment"
print_status "Cloud Run will create the necessary service accounts and grant Secret Manager access"
print_success "IAM setup deferred to Cloud Run deployment"

# Create Artifact Registry repository if it doesn't exist
print_header "Setting up Artifact Registry"
REPOSITORY="unmai-repo"
REGION="us-central1"

if ! gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" --quiet 2>/dev/null; then
    print_status "Creating Artifact Registry repository..."
    gcloud artifacts repositories create "$REPOSITORY" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Unmai.ai container images" \
        --quiet
    print_success "Artifact Registry repository created"
else
    print_status "Artifact Registry repository already exists"
fi

# Verify secrets are accessible
print_header "Verifying secret access"
print_status "Testing secret access..."

if gcloud secrets versions access latest --secret="gemini-api-key" --quiet > /dev/null; then
    print_success "GEMINI_API_KEY secret is accessible"
else
    print_error "Failed to access GEMINI_API_KEY secret"
    exit 1
fi

# List all created secrets
print_header "Secret Manager Summary"
print_status "Created/updated secrets:"
gcloud secrets list --filter="labels.app=unmai" --format="table(name,createTime,labels.environment)"

print_success "🎉 GCP Secret Manager setup completed successfully!"

print_header "Next Steps:"
print_status "1. Deploy your application:"
print_status "   gcloud builds submit --config cloudbuild-production.yaml"
print_status ""
print_status "2. Update secrets when needed:"
print_status "   echo 'new_value' | gcloud secrets versions add secret-name --data-file=-"
print_status ""
print_status "3. View secret versions:"
print_status "   gcloud secrets versions list secret-name"
print_status ""
print_status "4. Monitor secret usage:"
print_status "   gcloud logging read 'protoPayload.serviceName=\"secretmanager.googleapis.com\"'"

print_header "Security Notes:"
print_status "• Secrets are encrypted at rest and in transit"
print_status "• Access is logged and auditable"
print_status "• Use least-privilege IAM roles"
print_status "• Rotate secrets regularly"
print_status "• Monitor secret access logs"