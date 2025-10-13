# Unmai.ai Deployment Guide

This guide covers the complete deployment process for Unmai.ai, including the optimized build system, JWT environment handling, and GCP Secret Manager integration.

## 🚀 Quick Start

For a complete deployment from scratch:

```bash
# Set your GCP project
export GCP_PROJECT_ID="your-project-id"
export GEMINI_API_KEY="your-gemini-api-key"

# Complete deployment (recommended)
npm run deploy:complete
```

## 📋 Prerequisites

### Required Tools
- Node.js 18+ 
- npm 8+
- Google Cloud SDK (`gcloud`)
- Docker (for local testing)

### Required Environment Variables
- `GCP_PROJECT_ID` - Your Google Cloud Project ID
- `GEMINI_API_KEY` - Your Gemini API key (format: AIza...)

### Optional Environment Variables
- `GOOGLE_CUSTOM_SEARCH_API_KEY` - For enhanced web search capabilities
- `GOOGLE_SEARCH_ENGINE_ID` - Custom Search Engine ID

## 🔧 Setup Process

### 1. Authentication
```bash
# Authenticate with Google Cloud
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### 2. Environment Setup
Create a `.env` file in the project root:
```env
GCP_PROJECT_ID=your-project-id
GEMINI_API_KEY=AIza...your-key
GOOGLE_CUSTOM_SEARCH_API_KEY=AIza...your-search-key  # Optional
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id        # Optional
```

### 3. GCP Secret Manager Setup
```bash
# Setup secrets (automatically handles API keys securely)
npm run setup:gcp
```

### 4. JWT Environment Setup
```bash
# Setup JWT-based environment variables for enhanced security
npm run setup:jwt
```

## 🏗️ Build System

### Optimized Production Build
```bash
# Full optimized build with all features
npm run build

# Fast build (skips some optimizations)
npm run build:fast
```

### Build Features
- **JWT Environment Variables**: Secure handling of sensitive data
- **Parallel Builds**: Frontend and backend built simultaneously
- **Build Optimization**: Compression, tree-shaking, and caching
- **Type Checking**: Comprehensive TypeScript validation
- **Security Scanning**: Automated vulnerability checks

## 🚀 Deployment Options

### Option 1: Complete Deployment (Recommended)
```bash
# Handles everything: setup, secrets, build, and deployment
npm run deploy:complete
```

### Option 2: Step-by-Step Deployment
```bash
# 1. Setup GCP services and secrets
npm run setup:gcp

# 2. Build locally
npm run build

# 3. Deploy to cloud
npm run deploy:production
```

### Option 3: Local Development
```bash
# Start development servers
npm run dev

# Test locally with Docker
npm run deploy:local
```

## 🔐 Security Features

### JWT Environment Variables
- Sensitive environment variables are encoded using JWT-like tokens
- Secrets are encrypted and signed for integrity
- Automatic fallback to regular `.env` files in development

### Google Secret Manager Integration
- API keys stored securely in Google Secret Manager
- Automatic secret rotation support
- Audit logging for secret access
- IAM-based access control

### Container Security
- Non-root container execution
- Minimal base images (Alpine/Slim)
- Security headers enabled
- Regular security scanning

## 📊 Monitoring and Management

### Service Status
```bash
# Check service status
npm run status

# View service logs
npm run logs:backend
npm run logs:frontend

# Test connectivity
npm run health
```

### Cloud Console Links
- **Services**: https://console.cloud.google.com/run
- **Logs**: https://console.cloud.google.com/logs
- **Secrets**: https://console.cloud.google.com/security/secret-manager
- **Build History**: https://console.cloud.google.com/cloud-build/builds

## 🛠️ Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clean and rebuild
npm run clean:all
npm install
npm run build
```

#### Authentication Issues
```bash
# Re-authenticate
gcloud auth login
gcloud auth application-default login
```

#### Secret Access Issues
```bash
# Verify secrets exist
gcloud secrets list --filter="labels.app=unmai"

# Test secret access
gcloud secrets versions access latest --secret="gemini-api-key"
```

#### Service Deployment Issues
```bash
# Check service logs
gcloud logging read 'resource.type=cloud_run_revision' --limit=50

# Redeploy specific service
gcloud run deploy unmai-backend --region us-central1
```

### Performance Optimization

#### Backend Optimization
- Memory: 2Gi (optimized for AI workloads)
- CPU: 2 cores
- Concurrency: 100 requests
- Timeout: 900 seconds

#### Frontend Optimization
- Memory: 1Gi
- CPU: 1 core
- Concurrency: 1000 requests
- Timeout: 300 seconds

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
      - run: npm run deploy:production
```

## 📈 Scaling Considerations

### Auto-scaling Configuration
- **Min Instances**: 0 (cost-effective)
- **Max Instances**: 20 (backend), 10 (frontend)
- **CPU Utilization**: 70% target
- **Memory Utilization**: 80% target

### Performance Monitoring
- Response time monitoring
- Error rate tracking
- Resource utilization alerts
- Custom metrics for AI operations

## 🔧 Advanced Configuration

### Custom Regions
```bash
# Deploy to different region
gcloud builds submit --config cloudbuild-production.yaml \
  --substitutions _REGION=europe-west1
```

### Environment-Specific Deployments
```bash
# Staging deployment
gcloud builds submit --config cloudbuild-production.yaml \
  --substitutions _FRONTEND_SERVICE=unmai-frontend-staging,_BACKEND_SERVICE=unmai-backend-staging
```

### Resource Customization
Edit `cloudbuild-production.yaml` to modify:
- Memory allocation
- CPU allocation
- Concurrency limits
- Timeout values
- Instance scaling

## 📚 Additional Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Secret Manager Best Practices](https://cloud.google.com/secret-manager/docs/best-practices)
- [Cloud Build Configuration](https://cloud.google.com/build/docs/configuring-builds/create-basic-configuration)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)

## 🆘 Support

For deployment issues:
1. Check the troubleshooting section above
2. Review service logs: `npm run logs:backend` or `npm run logs:frontend`
3. Test connectivity: `npm run health`
4. Verify secrets: `gcloud secrets list --filter="labels.app=unmai"`

For development issues:
1. Ensure all prerequisites are installed
2. Verify environment variables are set correctly
3. Run local build: `npm run build`
4. Test locally: `npm run dev`