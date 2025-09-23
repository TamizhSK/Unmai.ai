// Simplified API client for calling backend functions through Express server

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Generic API call function
async function apiCall<T>(endpoint: string, data: any): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed (${response.status}): ${errorText || response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`API Response from ${endpoint}:`, result);
    return result;
  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error);
    throw error;
  }
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

export async function provideEducationalInsights(text: string) {
  return apiCall('/api/educational-insights', { text });
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
