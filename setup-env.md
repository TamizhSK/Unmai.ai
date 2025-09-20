# Verity AI - Environment Setup Guide

## Prerequisites

1. **Node.js 18+** installed
2. **Google Cloud Project** with the following APIs enabled:
   - Cloud Speech-to-Text API
   - Cloud Translation API
   - Vertex AI API
   - Web Risk API
   - Video Intelligence API
   - Vision API

## Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Google Cloud credentials:**
   ```bash
   # Option 1: Service Account Key (recommended for development)
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
   
   # Option 2: Application Default Credentials
   gcloud auth application-default login
   ```

4. **Create .env file in backend directory:**
   ```env
   PORT=3001
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

5. **Start the backend server:**
   ```bash
   npm run dev
   ```

## Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create .env.local file in frontend directory:**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

4. **Start the frontend development server:**
   ```bash
   npm run dev
   ```

## Testing the Integration

1. **Test backend endpoints:**
   ```bash
   node test-backend.js
   ```

2. **Open frontend in browser:**
   ```
   http://localhost:3000
   ```

## Common Issues & Solutions

### Backend Issues

1. **Google Cloud Authentication Error:**
   - Ensure service account has proper permissions
   - Check GOOGLE_APPLICATION_CREDENTIALS path
   - Verify APIs are enabled in Google Cloud Console

2. **Port Already in Use:**
   ```bash
   lsof -ti:3001 | xargs kill -9
   ```

3. **Audio Transcription Fails:**
   - Check audio format (supports WEBM, MP3, LINEAR16)
   - Ensure audio is base64 encoded
   - Verify Speech-to-Text API is enabled

### Frontend Issues

1. **API Connection Failed:**
   - Check backend is running on port 3001
   - Verify NEXT_PUBLIC_API_URL in .env.local
   - Check browser console for CORS errors

2. **Speech Recognition Not Working:**
   - Use HTTPS or localhost (required for microphone access)
   - Check browser permissions for microphone
   - Ensure browser supports Web Speech API

3. **File Upload Issues:**
   - Check file size limits (50MB max)
   - Verify supported formats: images, videos, audio
   - Check browser console for errors

## API Endpoints Reference

- `POST /api/fact-check` - Fact check claims
- `POST /api/web-analysis` - Real-time web analysis
- `POST /api/verify-source` - Verify source credibility
- `POST /api/safe-search` - Check URL safety
- `POST /api/detect-deepfake` - Detect deepfakes in media
- `POST /api/detect-synthetic` - Detect synthetic content
- `POST /api/transcribe-audio` - Transcribe audio to text
- `POST /api/translate-text` - Translate text
- `POST /api/credibility-score` - Get content credibility score
- `POST /api/educational-insights` - Get educational insights
- `POST /api/safety-assessment` - Assess content safety

## Development Tips

1. **Enable debug logging:**
   - Backend: Check console for API responses
   - Frontend: Open browser DevTools for detailed logs

2. **Test individual components:**
   - Use the test script to verify backend endpoints
   - Test frontend components in isolation

3. **Monitor API usage:**
   - Check Google Cloud Console for API quotas
   - Monitor costs for Vertex AI usage
