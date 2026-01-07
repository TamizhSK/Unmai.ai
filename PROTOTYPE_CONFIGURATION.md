# Prototype Configuration - Gemini API Key Only

## Overview
The backend has been configured to use **only the Gemini API key** for the prototype. All Google Cloud Platform (GCP) dependencies have been commented out due to ongoing issues.

## Changes Made

### 1. Environment Configuration
- **New Gemini API Key**: `***REDACTED_API_KEY***`
- Updated in:
  - `.env` (root)
  - `backend/.env`
- **GCP_PROJECT_ID**: Commented out (not required for prototype)
- **Model Configuration**: Using `gemini-2.0-flash-exp` (latest experimental model)

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

## Running the Backend

```bash
cd backend
npm install
npm start
```

The backend will start on port 3001 and use only the Gemini API key for all operations.

## Important Notes

1. **Prototype Only**: This configuration is for prototype/testing purposes only
2. **Safety Disabled**: Content safety filters are disabled to allow testing of all input types
3. **API Key Security**: The API key is stored in `.env` files - ensure these are not committed to public repositories
4. **GCP Issues**: All GCP-related code is commented out (not deleted) so it can be easily restored when issues are resolved
5. **Model Version**: Using `gemini-2.0-flash-exp` - the latest experimental model

## Restoring GCP Integration

When GCP issues are resolved:
1. Uncomment all Vertex AI imports and initialization code
2. Uncomment Google Cloud Secret Manager code in `secure-env.ts`
3. Add `GCP_PROJECT_ID` back to required environment variables
4. Update safety settings as needed for production
5. Test both Gemini API and Vertex AI paths

## Environment Variables Required

**Required:**
- `GEMINI_API_KEY` - The new Gemini API key

**Optional:**
- `GOOGLE_CUSTOM_SEARCH_API_KEY` - For web search functionality
- `GOOGLE_SEARCH_ENGINE_ID` - For custom search engine
- `PORT` - Server port (default: 3001)
- `VERTEX_AI_TEXT_MODEL` - Model name (default: gemini-2.0-flash-exp)
- `VERTEX_AI_VISION_MODEL` - Vision model name (default: gemini-2.0-flash-exp)
