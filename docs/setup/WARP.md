# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project: Unmai.ai — AI-powered content verification and analysis

- Monorepo layout: frontend (Next.js), backend (Node/Express), shared root scripts for build/deploy.
- Platforms: Google Cloud Run (deploy), Cloud Build (CI/CD), Secret Manager (secrets), Artifact Registry (images).
- Minimum Node version: 18+

Common commands

Root (recommended entry point)
- Install all deps
  - npm run install:all
- Start both apps in dev (frontend:3000, backend:3001)
  - npm run dev
- Build (optimized, orchestrated)
  - npm run build
  - Fast build (skips some checks): SKIP_TESTS=true npm run build:fast
- Start both apps from built artifacts/runtime scripts
  - npm start
- Clean artifacts and node_modules
  - npm run clean (workspace artifacts)
  - npm run clean:all (adds root node_modules, JWT env files)
- Type checks (note: currently mostly no-op; see notes below)
  - npm run typecheck
- Environment/secrets setup
  - JWT env bootstrap: npm run setup:jwt
  - GCP Secret Manager bootstrap: npm run setup:gcp
- Connectivity and status
  - Quick health/connectivity: npm run health
  - Cloud Run service status: npm run status
  - Cloud logs (production): npm run logs:backend, npm run logs:frontend
- Deploy (Cloud Build → Cloud Run)
  - Minimal pipeline submit: npm run deploy:production
  - Local docker-compose: npm run deploy:local

Per-package
- Frontend
  - Dev: cd frontend && npm run dev
  - Build: cd frontend && npm run build
  - Start: cd frontend && npm run start
  - Lint: cd frontend && npm run lint
  - Typecheck (currently disabled): cd frontend && npm run typecheck
- Backend
  - Dev: cd backend && npm run dev
  - Dev (watch): cd backend && npm run dev:watch
  - Start: cd backend && npm run start
  - Typecheck (currently prints a message): cd backend && npm run typecheck

Tests and single checks
- This repository does not include a unit test runner configuration. Use the provided connectivity checks during development:
  - Health-only check (backend must be running): curl -s http://localhost:3001/health | jq .
  - Single endpoint check (unified analyze): curl -s -X POST http://localhost:3001/api/analyze -H 'Content-Type: application/json' -d '{"type":"text","payload":{"text":"hello"}}' | jq .
  - End-to-end connectivity helper: npm run health (runs scripts/test-connectivity.js)

Environment and configuration
- Required (backend and build scripts will fail fast if missing):
  - GCP_PROJECT_ID, GEMINI_API_KEY
- Optional (enables web search enrichment):
  - GOOGLE_CUSTOM_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID
- Frontend/backend connectivity (local):
  - NEXT_PUBLIC_API_BASE_URL (frontend) defaults to http://localhost:3001 during local dev.
- JWT-based environment management
  - npm run setup:jwt creates .env.secret and .env.jwt; backend loads via scripts/load-jwt-env.js with a dotenv fallback in development.

High-level architecture

Overview
- Frontend: Next.js 15 (App Router), React 18, Tailwind + shadcn/ui. Frontend talks to backend via a thin API client (frontend/src/lib/simple-api-client.ts) that:
  - Tracks backend health with periodic checks.
  - Adds request timeouts and retry with exponential backoff.
  - Reads NEXT_PUBLIC_API_BASE_URL for the backend base URL (in production, injected by Cloud Build).
- Backend: Node/Express server (backend/src/server.ts) exposing JSON endpoints with a preferred unified entrypoint:
  - POST /api/analyze — single multimodal endpoint (type: text|url|image|video|audio, payload varies)
  - Additional focused endpoints are retained (fact-check, credibility-score, detect-deepfake, safety-assessment, verify-source, web-analysis, safe-search, translate-text) but product flow should prefer /api/analyze.
  - Strict JSON responses with centralized error handling; request body size capped via REQUEST_SIZE_LIMIT.
  - Environment bootstrap tries secure JWT-based loader first, then falls back to dotenv when unavailable during development.
- AI integration (backend/src/ai)
  - genkit.ts sets up Vertex AI and the direct Gemini API client. It validates required envs, and provides helpers to select preferred models.
  - flows/* implement task-specific pipelines (fact checking, safety, unified multimodal analysis, deepfake detection, translation, URL/web analysis, source verification). These are invoked by the Express routes in server.ts.

Build and deployment flow
- Local optimized build (scripts/build-production.sh)
  - Validates Node 18+, required envs, and formats.
  - Creates JWT env files and loader when needed.
  - Backend: uses tsx to run TypeScript at runtime; generates backend/dist/server.js launcher wrappers.
  - Frontend: writes .env.production (production) or .env.local (development) to wire backend URL; Next.js configured with output:'standalone', disabled TS/ESLint blocking during build for resilience.
  - Optionally runs npm audit; emits build-manifest.json summary.
- Cloud Build (cloudbuild-minimal.yaml)
  - Builds/pushes backend image → deploys to Cloud Run → resolves backend URL → writes frontend .env.production with NEXT_PUBLIC_API_BASE_URL → builds/pushes frontend → deploys to Cloud Run → verifies connectivity.
  - Substitutions: _REGION, _FRONTEND_SERVICE, _BACKEND_SERVICE, _ARTIFACT_REGISTRY, _REPOSITORY.
- CI/CD (GitHub Actions: .github/workflows/deploy.yml)
  - Test job installs workspace deps, runs typecheck scripts, and builds both apps.
  - Deploy job authenticates to GCP via Workload Identity Federation, submits Cloud Build, and posts service URLs on PRs.

Local development notes
- Ports
  - Frontend: 3000
  - Backend: 3001
- Docker Compose
  - docker-compose.yml builds and runs both services with shared network; FRONTEND uses NEXT_PUBLIC_API_URL build arg/env to reach BACKEND (defaults to http://localhost:3001).
- TypeScript gates currently relaxed
  - Frontend next.config.ts ignores TS and ESLint errors during build.
  - Package scripts typecheck steps are presently no-ops; rely on IDE/language server during iteration, or enable strict checks before enforcing in CI.

Where to make common changes
- Add/modify backend endpoint
  - Route: backend/src/server.ts
  - Business logic: backend/src/ai/flows/* (create a new flow or reuse existing ones via genkit.ts models)
- Call new backend capability from the UI
  - API surface: frontend/src/lib/simple-api-client.ts
  - UI and state: app router pages/components under frontend/src/app and frontend/src/components
- Change deployment/resource sizing
  - Cloud Run resources: cloudbuild-minimal.yaml deploy steps
  - GitHub Actions behavior: .github/workflows/deploy.yml

Important excerpts from README
- Prereqs: Node 18+, npm/yarn, Git, GCP account for service auth.
- Quick start
  - npm run install:all
  - npm run dev
  - Frontend: http://localhost:3000, Backend health: http://localhost:3001/health
- Core services: Vertex AI, Vision, Video Intelligence, Speech-to-Text, Cloud Translation, Web Risk, Firestore.

Troubleshooting helpers
- Kill backend port locally (if EADDRINUSE): lsof -ti:3001 | xargs kill -9
- Validate env quickly (backend script): cd backend && npm run test:env
- End-to-end connectivity locally: npm run health

Notes and constraints
- Secrets are expected via JWT env files or Google Secret Manager in production; the build and backend will exit early if GCP_PROJECT_ID or GEMINI_API_KEY are missing.
- The production pipeline injects the backend URL into the frontend’s .env.production to avoid cross-origin misconfiguration.
- No unit test runner is configured at present; rely on health checks, endpoint probes, and connectivity verifier during development until tests are introduced.
