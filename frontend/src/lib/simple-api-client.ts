// Optimized API client with enhanced connectivity and error handling

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

// Auth token management
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function clearAuthToken() {
  _authToken = null;
}

export function getAuthToken(): string | null {
  return _authToken;
}

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

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (_authToken) {
        headers['Authorization'] = `Bearer ${_authToken}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
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


export async function analyzeUnified(type: 'text' | 'url' | 'image' | 'video' | 'audio', payload: any, searchEngineId?: string) {
  return apiCall('/api/analyze', { type, payload, searchEngineId });
}

// SSE streaming analysis — calls /api/analyze/stream with progress callbacks
export async function analyzeUnifiedStream(
  type: 'text' | 'url' | 'image' | 'video' | 'audio',
  payload: any,
  onProgress: (stage: string, message: string, elapsed: number, expectedChecks?: string[]) => void,
  onResult: (result: any) => void,
  onError: (error: string) => void,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  let resultReceived = false;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, payload }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stream failed (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (currentEvent === 'progress') {
              onProgress(parsed.stage, parsed.message, parsed.elapsed, parsed.expectedChecks);
            } else if (currentEvent === 'result') {
              resultReceived = true;
              onResult(parsed);
            } else if (currentEvent === 'error') {
              // Error event — but check if we also got a fallback result
              if (!resultReceived) {
                onError(parsed.message || parsed.error || 'Analysis failed');
              }
            } else if (currentEvent === 'done') {
              // Stream completed
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    // Process any remaining buffer data (in case last event had no trailing newline)
    if (buffer.trim()) {
      const remainingLines = buffer.split('\n');
      let currentEvent = '';
      for (const line of remainingLines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (currentEvent === 'result' && !resultReceived) {
              resultReceived = true;
              onResult(parsed);
            }
          } catch {}
        }
      }
    }

    // If stream ended without result, that's an error
    if (!resultReceived) {
      throw new Error('Stream ended without receiving result');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      onError('Analysis timed out. Please try again.');
    } else if (error instanceof Error && error.message === 'Stream ended without receiving result') {
      // This means the connection closed prematurely - throw to trigger fallback
      throw error;
    } else {
      onError(error instanceof Error ? error.message : 'Stream error occurred');
    }
  }
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

// Batch translate multiple texts in a single API call
export async function translateBatch(texts: string[], targetLanguage: string): Promise<string[]> {
  if (!texts.length) return [];
  const nonEmpty = texts.map((t, i) => ({ t: t?.trim(), i })).filter(x => x.t);
  if (!nonEmpty.length) return texts;

  const result = await apiCall<{ translations: string[] }>(
    '/api/translate-batch',
    { texts: nonEmpty.map(x => x.t), targetLanguage }
  );

  const output = [...texts];
  nonEmpty.forEach((x, idx) => {
    output[x.i] = result.translations?.[idx] ?? texts[x.i];
  });
  return output;
}

// Authenticated GET request helper
export async function authGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  if (!_authToken) {
    throw new Error('Not authenticated');
  }

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${_authToken}`,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed (${response.status})`);
  }

  return response.json();
}

// Auth API calls (POST without retry — auth errors shouldn't be retried)
export async function authPost<T>(endpoint: string, data: any): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `Request failed (${response.status})` }));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  return response.json();
}
