# Verity AI

Verity AI is an AI-powered content verification and analysis platform that helps users identify misinformation, detect deepfakes, and assess content credibility.

## Project Structure

This is a monorepo with separate frontend and backend applications:

- `frontend/` - Next.js 15 React application with modern UI components
- `backend/` - Google Genkit AI service with TypeScript

## Quick Start

1. **Install all dependencies:**
```bash
npm run install:all
```

2. **Set up environment variables:**
   - Backend: Create `backend/.env` with your Google Cloud credentials
   - Frontend: Create `frontend/.env.local` with your configuration

3. **Start development servers:**
```bash
npm run dev
```

This will start both the frontend (port 3000) and backend services concurrently.

## Individual Development

### Frontend Only
```bash
cd frontend
npm install
npm run dev
```

### Backend Only
```bash
cd backend
npm install
npm run dev
```

## Available Scripts

- `npm run dev` - Start both frontend and backend
- `npm run build` - Build both applications
- `npm run start` - Start production servers
- `npm run clean` - Clean all build artifacts
- `npm run typecheck` - Run TypeScript checking for both apps

## Features

- **Fact Checking** - Verify claims against reliable sources
- **Deepfake Detection** - Detect AI-generated images and videos
- **Credibility Scoring** - Assess content trustworthiness
- **Safety Assessment** - Evaluate content for harmful material
- **Source Verification** - Verify content sources and domains
- **Educational Insights** - Provide learning resources and context
- **Web Analysis** - Analyze web content and trends
- **Audio Transcription** - Convert speech to text
- **Synthetic Content Detection** - Identify AI-generated content
- **Misinformation Analysis** - Detect misleading information

## Technology Stack

### Frontend
- Next.js 15 with App Router
- React 18 with TypeScript
- Tailwind CSS with shadcn/ui components
- Radix UI primitives
- Lucide React icons

### Backend
- Google Genkit AI framework
- Google Cloud Vertex AI
- TypeScript with Node.js
- Google Cloud services (Speech, Vision, Translate, etc.)

## Development Standards

- Separate `package.json` and `node_modules` for each workspace
- TypeScript strict mode enabled
- ESLint and Prettier configuration
- Proper error handling and logging
- Production-ready build configurations
