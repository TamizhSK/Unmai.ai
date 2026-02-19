# Environment Variables Setup

This document explains how to set up environment variables for local development.

## Quick Start

### Backend Setup

1. Copy the example file:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Update `backend/.env` with your actual values:
   - `GOOGLE_CLOUD_PROJECT`: Your Google Cloud project ID
   - `GOOGLE_CLOUD_API_KEY`: Your Google Cloud API key
   - Other configuration as needed

### Frontend Setup

1. Copy the example file:
   ```bash
   cp frontend/.env.local.example frontend/.env.local
   ```

2. The default configuration points to `http://localhost:3001` which should work for local development.

## Environment Files Overview

### Files Tracked in Git (Safe to Commit)
- ✅ `backend/.env.example` - Template for backend environment variables
- ✅ `frontend/.env.local.example` - Template for frontend local development
- ✅ `frontend/.env.production` - Production environment configuration

### Files Ignored by Git (Contains Secrets)
- 🔒 `backend/.env` - Your actual backend environment variables
- 🔒 `frontend/.env.local` - Your local frontend configuration
- 🔒 `.env`, `.env.jwt`, `.env.secret` - Root level secrets

## Important Notes

- **Never commit actual `.env` files** (except `.env.example` and `.env.production`)
- The `.env.local` file is for local development only
- Production environment variables are managed in Cloud Run/Cloud Build
- Keep your API keys and secrets secure

## Testing Your Setup

1. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. Open http://localhost:3000 in your browser

The frontend should connect to the backend at http://localhost:3001
