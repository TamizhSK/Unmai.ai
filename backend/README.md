# unmai.ai Backend

This is the backend service for unmai.ai, built with Google Genkit and TypeScript.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up Google Cloud authentication:
```bash
# Authenticate with Google Cloud (creates Application Default Credentials)
gcloud auth application-default login

# Set your default project (optional, can also be set in .env)
gcloud config set project your-project-id
```

3. Configure environment variables:
The `.env` file contains complete configuration with setup instructions:
```bash
# Edit the .env file with your credentials
nano .env

# Required: Update these two values
GCP_PROJECT_ID=your-google-cloud-project-id
GEMINI_API_KEY=your-gemini-api-key

# Optional: All other settings have sensible defaults
```

**Important Notes**:
- The backend uses **Application Default Credentials** (no service account needed)
- Both `GCP_PROJECT_ID` and `GEMINI_API_KEY` are required
- Other Google Cloud services auto-detect the project
- The `.env` file contains complete setup instructions
- Never commit your `.env` file to version control

4. Run the development server:
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
