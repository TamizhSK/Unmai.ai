# Verity Backend

This is the backend service for Verity AI, built with Google Genkit and TypeScript.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file with:
```
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
```

3. Run the development server:
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run dev:watch` - Start development server with file watching
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run clean` - Clean build artifacts

## Project Structure

- `src/ai/` - AI flows and Genkit configuration
- `src/ai/flows/` - Individual AI analysis flows
- `dist/` - Compiled JavaScript output

## AI Flows

The backend provides the following AI analysis capabilities:

- **Fact Checking** - Verify claims against reliable sources
- **Credibility Scoring** - Assess content credibility
- **Deepfake Detection** - Detect AI-generated media
- **Educational Insights** - Provide learning resources
- **Safety Assessment** - Evaluate content safety
- **Source Verification** - Verify content sources
- **Web Analysis** - Analyze web content
- **Synthetic Content Detection** - Detect AI-generated content
- **Misinformation Analysis** - Identify misleading content
- **Safe Search** - Check URL safety
- **Audio Transcription** - Convert speech to text
