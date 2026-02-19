# Prototype Configuration - Gemini API Key Only

## Overview
The backend has been configured to use **only the Gemini API key** for the prototype. All Google Cloud Platform (GCP) dependencies have been commented out due to ongoing issues.

## Quick Start

### For Development (Recommended)
```bash
npm run dev
```
This runs both frontend and backend in development mode.

### Backend Only (For API Testing)
```bash
node run-backend-only.js
```
Or manually:
```bash
cd backend && npm run dev
```

### Production Mode (Requires Build)
```bash
# Build frontend first
cd frontend && npm run build && cd ..
# Then start both
npm run start
```

## API Key Configuration
- **New Gemini API Key**: Set in `backend/.env` (see `.env.example`)
- **Model**: `gemini-2.0-flash-exp` (Latest Gemini 2.0 Flash experimental)
- **Note**: Gemini 2.5 is not available via direct API key yet (only through Vertex AI)

## Changes Made

### 1. Environment Configuration
- Updated in:
  - `.env` (root)
  - `backend/.env`
- **GCP_PROJECT_ID**: Commented out (not required for prototype)
- **Model Configuration**: Using `gemini-2.0-flash-exp`

### 2. Backend Code Changes

#### `backend/src/ai/genkit.ts`
- Commented out Vertex AI imports and initialization
- Using Gemini API exclusively via `GoogleGenerativeAI`
- Safety settings set to `BLOCK_NONE` for all categories (prototype only)
- `UnifiedModel` class now uses only Gemini API (Vertex AI code commented out)
- All models export Gemini API instances

#### `backend/src/ai/ai-models.ts`
- Commented out Vertex AI imports and initialization
- All model exports now use Gemini API directly
- Safety settings disabled for prototype testing
- `vertexAI` export set to `null`

#### `backend/src/server.ts`
- Removed `GCP_PROJECT_ID` from required environment variables
- Added prototype mode logging
- Health check updated to show GCP as disabled

#### `backend/src/lib/secure-env.ts`
- Google Cloud Secret Manager completely disabled
- `GCP_PROJECT_ID` moved to optional variables
- Environment loading now skips GCP secrets

#### `backend/src/lib/jwt-env-loader.ts`
- Updated default validation to not require `GCP_PROJECT_ID`

### 3. Safety Settings
All Gemini models configured with:
```typescript
safetySettings: [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
]
```
**Note**: This allows the API to analyze all kinds of inputs for prototype testing.

## Testing the API

### Health Check
```bash
curl http://localhost:3001/health
```

### Test Text Analysis
```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"type": "text", "payload": {"text": "The sky is blue"}}'
```

### Test URL Analysis
```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"type": "url", "payload": {"url": "https://example.com"}}'
```

## What Still Works

✅ All AI flows use Gemini API key
✅ Text analysis
✅ URL analysis  
✅ Image analysis
✅ Video analysis
✅ Audio analysis
✅ Fact checking
✅ Credibility scoring
✅ Deepfake detection
✅ Safety assessment
✅ Source verification
✅ Web analysis (with Custom Search API if configured)
✅ Translation

## What's Disabled

❌ Vertex AI integration
❌ Google Cloud Secret Manager
❌ GCP authentication requirements
❌ Content safety filtering (for prototype testing)

## Troubleshooting

### Frontend Build Issues
If you get "Could not find a production build" error:
```bash
cd frontend
rm -rf .next
npm run build
cd ..
npm run start
```

### Use Development Mode Instead
For development, always use:
```bash
npm run dev
```
This avoids build issues and provides hot reloading.

## Important Notes

1. **Prototype Only**: This configuration is for prototype/testing purposes only
2. **Safety Disabled**: Content safety filters are disabled to allow testing of all input types
3. **API Key Security**: The API key is stored in `.env` files - ensure these are not committed to public repositories
4. **GCP Issues**: All GCP-related code is commented out (not deleted) so it can be easily restored when issues are resolved
5. **Model Version**: Using `gemini-2.0-flash-exp` - the latest available Gemini 2.0 model via API key
6. **Gemini 2.5**: Not available via direct API key yet - only through Vertex AI (which is disabled for prototype)

## Environment Variables Required

**Required:**
- `GEMINI_API_KEY` - The new Gemini API key

**Optional:**
- `GOOGLE_CUSTOM_SEARCH_API_KEY` - For web search functionality
- `GOOGLE_SEARCH_ENGINE_ID` - For custom search engine
- `PORT` - Server port (default: 3001)
- `VERTEX_AI_TEXT_MODEL` - Model name (default: gemini-2.0-flash-exp)
- `VERTEX_AI_VISION_MODEL` - Vision model name (default: gemini-2.0-flash-exp)
