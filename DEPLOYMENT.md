# Deployment Guide for Unmai.ai

## Overview

Unmai.ai uses Google Cloud Platform (GCP) with Cloud Build and Cloud Run for deployment. This setup provides:

- **Automatic scaling** based on traffic
- **Pay-per-use** pricing model
- **Zero-downtime deployments**
- **Integrated monitoring and logging**

## Architecture

```
GitHub → GitHub Actions → Cloud Build → Cloud Run
                              ↓
                        Container Registry
```

- **Frontend**: Next.js app deployed to Cloud Run
- **Backend**: Node.js/TypeScript API deployed to Cloud Run
- **Build**: Multi-stage Docker builds for optimization
- **CI/CD**: GitHub Actions with automated testing and deployment

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **GitHub repository** with the code
3. **Gemini API key** for AI functionality
4. **gcloud CLI** installed locally

## Quick Setup

### 1. Initial GCP Setup

Run the setup script to configure your GCP environment:

```bash
./scripts/setup-deployment.sh YOUR_PROJECT_ID us-central1
```

This script will:
- Enable required GCP APIs
- Create Artifact Registry repository
- Set up Secret Manager with your API keys
- Configure IAM permissions
- Set up Workload Identity Federation for GitHub Actions

### 2. GitHub Secrets Configuration

Add these secrets to your GitHub repository settings:

```
GCP_PROJECT_ID: your-gcp-project-id
WIF_PROVIDER: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
WIF_SERVICE_ACCOUNT: github-actions@PROJECT_ID.iam.gserviceaccount.com
```

### 3. Deploy

Once configured, every push to `main` branch will automatically deploy your application.

## Manual Deployment

For manual deployment or testing:

```bash
./scripts/deploy-local.sh YOUR_PROJECT_ID us-central1
```

## Local Development

### Using Docker Compose

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your values

# Start services
docker-compose up --build

# Your app will be available at:
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

### Using npm workspaces

```bash
# Install dependencies
npm install

# Start development servers
npm run dev

# Or start individually
npm run dev:frontend  # Port 3000
npm run dev:backend   # Port 3001
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GCP_PROJECT_ID` | Your GCP project ID | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `NEXT_PUBLIC_API_URL` | Backend API URL (auto-configured in production) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `REQUEST_SIZE_LIMIT` | Max request size for file uploads | No |

### Cloud Run Configuration

Both services are configured with:
- **Memory**: 1-2GB depending on service
- **CPU**: 1-2 vCPUs
- **Concurrency**: 80-100 requests per instance
- **Auto-scaling**: 0-10 instances
- **Timeout**: 15 minutes
- **Generation**: gen2 (faster cold starts)

## Monitoring and Debugging

### View Logs

```bash
# Frontend logs
gcloud logs tail --follow --project=YOUR_PROJECT_ID \
  --filter='resource.labels.service_name=unmai-frontend'

# Backend logs
gcloud logs tail --follow --project=YOUR_PROJECT_ID \
  --filter='resource.labels.service_name=unmai-backend'
```

### Health Checks

- Frontend: `https://your-frontend-url/`
- Backend: `https://your-backend-url/health` (if implemented)

### Performance Monitoring

Visit Google Cloud Console:
- **Cloud Run** → Services → Select your service
- **Monitoring** tab for metrics
- **Logs** tab for detailed logs
- **Revisions** tab for deployment history

## Troubleshooting

### Common Issues

1. **Build Timeout**
   - Increase timeout in `cloudbuild.yaml`
   - Optimize Docker layers
   - Use `.dockerignore` to exclude unnecessary files

2. **Memory Issues**
   - Increase memory allocation in Cloud Run
   - Optimize application memory usage
   - Consider using streaming for large data processing

3. **Cold Start Latency**
   - Set minimum instances > 0
   - Use gen2 execution environment
   - Optimize application startup time

4. **API Key Issues**
   - Verify Secret Manager configuration
   - Check IAM permissions for Cloud Build service account
   - Ensure secrets are properly referenced in deployment

### Debug Commands

```bash
# Check service status
gcloud run services describe SERVICE_NAME --region=REGION

# View recent deployments
gcloud run revisions list --service=SERVICE_NAME --region=REGION

# Test locally
docker build -f backend/Dockerfile -t test-backend .
docker run -p 3001:3001 -e GEMINI_API_KEY=your-key test-backend
```

## Security Best Practices

1. **API Keys**: Store in Secret Manager, never in code
2. **IAM**: Use principle of least privilege
3. **HTTPS**: All services use HTTPS by default
4. **CORS**: Configure proper CORS policies
5. **Authentication**: Add authentication for sensitive endpoints

## Cost Optimization

1. **Auto-scaling**: Services scale to zero when not in use
2. **Resource allocation**: Right-sized CPU and memory
3. **Efficient builds**: Multi-stage Docker builds
4. **Request concurrency**: Optimized for your workload

## Scaling Considerations

- **Horizontal scaling**: Cloud Run handles automatically
- **Database**: Consider Cloud SQL or Firestore for persistent data
- **CDN**: Use Cloud CDN for static assets
- **Load balancing**: Built into Cloud Run

## Next Steps

1. **Custom Domain**: Configure custom domain and SSL
2. **Database**: Add Cloud SQL or Firestore if needed
3. **Monitoring**: Set up alerting and monitoring dashboards
4. **Backup**: Implement backup strategies for critical data
5. **Testing**: Add more comprehensive tests to the CI/CD pipeline

## Support

For issues and questions:
1. Check the [troubleshooting section](#troubleshooting)
2. Review Cloud Run documentation
3. Check GitHub Actions logs for CI/CD issues
4. Monitor Google Cloud Console for service health
