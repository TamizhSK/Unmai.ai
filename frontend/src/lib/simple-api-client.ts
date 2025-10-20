// Optimized API client with enhanced connectivity and error handling

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

// Connection health check
let isBackendHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

async function checkBackendHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL && isBackendHealthy) {
    return isBackendHealthy;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    isBackendHealthy = response.ok;
    lastHealthCheck = now;
    
    if (!isBackendHealthy) {
      console.warn(`[WARN] Backend health check failed: ${response.status}`);
    }
    
    return isBackendHealthy;
  } catch (error) {
    console.error('[ERROR] Backend health check failed:', error);
    isBackendHealthy = false;
    lastHealthCheck = now;
    return false;
  }
}

// Enhanced API call function with retry logic
async function apiCall<T>(endpoint: string, data: any, retries = 2): Promise<T> {
  // Check backend health first
  const isHealthy = await checkBackendHealth();
  if (!isHealthy) {
    throw new Error('Backend service is currently unavailable. Please try again later.');
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const REQUEST_TIMEOUT_MS = 120000; // 120 second timeout to accommodate cold starts and long AI runs
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Unmai-Frontend/1.0'
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle specific error cases
        if (response.status === 413) {
          throw new Error('Request too large. Please reduce the size of your content.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else if (response.status >= 500) {
          throw new Error(`Server error (${response.status}). Please try again later.`);
        }
        
        throw new Error(`API call failed (${response.status}): ${errorText || response.statusText}`);
      }
      
      const result = await response.json();
      
      // Log successful API calls in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API] ${endpoint} - Success`);
      }
      
      return result;
    } catch (error) {
      if (attempt === retries) {
        console.error(`[API ERROR] ${endpoint} failed after ${retries + 1} attempts:`, error);
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 1000;
      console.warn(`[API RETRY] ${endpoint} attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error('API call failed after all retry attempts');
}

// Simplified API functions
export async function factCheckClaim(claim: string) {
  return apiCall('/api/fact-check', { claim });
}

export async function analyzeUnified(type: 'text' | 'url' | 'image' | 'video' | 'audio', payload: any, searchEngineId?: string) {
  return apiCall('/api/analyze', { type, payload, searchEngineId });
}

export async function getCredibilityScore(text: string) {
  return apiCall('/api/credibility-score', { text });
}

export async function detectDeepfake(media: string, contentType: 'image' | 'video', sourceCredibility?: number) {
  return apiCall('/api/detect-deepfake', { media, contentType, sourceCredibility });
}



export async function assessSafety(content: string, contentType: 'text' | 'url' | 'image') {
  return apiCall('/api/safety-assessment', { content, contentType });
}

export async function verifySource(content: string, contentType: 'text' | 'url' | 'image') {
  return apiCall('/api/verify-source', { content, contentType });
}

export async function performWebAnalysis(query: string, contentType: 'text' | 'url', searchEngineId?: string) {
  return apiCall('/api/web-analysis', { query, contentType, searchEngineId });
}

export async function safeSearchUrl(url: string) {
  return apiCall('/api/safe-search', { url });
}

export async function translateText(text: string, targetLanguage: string) {
  // Validate input
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input for translation');
  }
  if (!targetLanguage || typeof targetLanguage !== 'string') {
    throw new Error('Invalid target language for translation');
  }
  
  return apiCall('/api/translate-text', { text: text.trim(), targetLanguage });
}
