# Unmai.ai Documentation

All project documentation is organized here. The root `README.md` covers the project overview; this directory covers setup, deployment, architecture, and development history.

## Directory Structure

```
docs/
├── README.md                  ← You are here
├── LICENSE                    ← MIT License
├── setup/                     ← Environment setup & configuration
│   ├── ENV_SETUP.md           ← Environment variable setup guide
│   ├── env-setup-guide.md     ← Step-by-step env configuration
│   ├── PROTOTYPE_CONFIGURATION.md  ← Prototype mode (Gemini API only)
│   ├── API_QUOTA_ISSUE_SOLUTION.md ← Gemini API quota troubleshooting
│   └── WARP.md                ← Developer workflow guide
├── deployment/                ← Deployment & infrastructure
│   ├── DEPLOYMENT.md          ← Deployment overview (Cloud Run, CI/CD)
│   ├── DEPLOYMENT_GUIDE.md    ← Detailed deployment walkthrough
│   ├── deployment-guide.md    ← GCP deployment architecture
│   ├── FINAL_DEPLOYMENT_STATUS.md ← Production deployment status
│   └── BUILD_OPTIMIZATION_SUMMARY.md ← Build pipeline optimizations
├── architecture/              ← System design & specifications
│   ├── OPTIMIZATION_SUMMARY.md     ← AI flow optimization strategy
│   ├── UNIFIED_RESPONSE_FORMAT.md  ← API response schema spec
│   └── FRONTEND_DISPLAY_REQUIREMENTS.md ← UI display requirements
└── changelog/                 ← Development history & fix tracking
    ├── ACTIVITY.md
    ├── BACKEND_OPTIMIZATION_COMPLETE.md
    ├── COMPLETE_FRONTEND_BACKEND_FIX.md
    ├── RESPONSE_FORMATTING_FIX.md
    ├── ... (30+ implementation tracking docs)
    └── GROUNDING_IMPLEMENTATION_COMPLETE.md
```

## Quick Links

### Getting Started
1. [Environment Setup](setup/ENV_SETUP.md) - Configure `.env` files for local development
2. [Prototype Configuration](setup/PROTOTYPE_CONFIGURATION.md) - Running with Gemini API only (no GCP)
3. [API Quota Troubleshooting](setup/API_QUOTA_ISSUE_SOLUTION.md) - Solutions for quota issues

### Deployment
1. [Deployment Overview](deployment/DEPLOYMENT.md) - Architecture and deployment flow
2. [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md) - Step-by-step deployment instructions
3. [Build Optimization](deployment/BUILD_OPTIMIZATION_SUMMARY.md) - Build pipeline details

### Architecture
1. [AI Flow Optimization](architecture/OPTIMIZATION_SUMMARY.md) - Performance strategy per content type
2. [Response Format](architecture/UNIFIED_RESPONSE_FORMAT.md) - Unified API response schema
3. [Frontend Display](architecture/FRONTEND_DISPLAY_REQUIREMENTS.md) - UI component specifications

### Development History
The `changelog/` directory contains implementation tracking documents for all major fixes, optimizations, and feature implementations. These serve as a historical record of the development process.

## Environment Files Reference

| File | Tracked | Purpose |
|------|---------|---------|
| `backend/.env.example` | Yes | Backend env template |
| `backend/.env` | **No** | Actual backend secrets |
| `frontend/.env.local.example` | Yes | Frontend env template |
| `frontend/.env.local` | **No** | Local frontend config |
| `frontend/.env.production` | Yes | Production frontend config (no secrets) |

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS, Radix UI |
| Backend | Express.js, TypeScript, Google Genkit AI |
| AI Services | Gemini API, Vertex AI, Vision API, Video Intelligence, Speech-to-Text |
| Infrastructure | Google Cloud Run, Cloud Build, Docker |
| Database | Firestore |
