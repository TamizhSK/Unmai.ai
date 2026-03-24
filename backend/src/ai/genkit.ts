import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenerativeAI, GenerativeModel as GeminiModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// CRITICAL: Load environment variables immediately
// This must happen before any validation since this file can be imported directly
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });

// Validate required environment variables
const project = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GCP_LOCATION || 'us-central1';
const geminiApiKey = process.env.GEMINI_API_KEY;

// Latest Gemini 2.5 Flash model - fast, capable, and cost-effective
const textModel = process.env.VERTEX_AI_TEXT_MODEL || 'gemini-2.5-flash';
const visionModel = process.env.VERTEX_AI_VISION_MODEL || 'gemini-2.5-flash';

if (!project) {
  throw new Error('GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable is required');
}

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

// Initialize Vertex AI for GCP APIs
export const vertexAI = new VertexAI({ project, location });

// Initialize direct Gemini API client
export const geminiAI = new GoogleGenerativeAI(geminiApiKey);

// Direct Gemini API models
export const geminiTextModel = geminiAI.getGenerativeModel({
  model: textModel,
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ]
});

export const geminiVisionModel = geminiAI.getGenerativeModel({
  model: visionModel,
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ]
});

/**
 * Unified model wrapper for Gemini API
 */
interface UnifiedGenerateContentRequest {
  contents: Array<{
    role: string;
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string }; fileData?: { fileUri: string; mimeType: string } }>;
  }>;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
  tools?: any[];
}

interface UnifiedGenerateContentResult {
  response: {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
}

class UnifiedModel {
  private geminiModel: GeminiModel;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 500; // 500ms between requests
  private readonly MAX_REQUESTS_PER_MINUTE = 30;

  constructor(geminiModel: GeminiModel) {
    this.geminiModel = geminiModel;
  }

  private async rateLimitCheck(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Reset request count every minute
    if (timeSinceLastRequest > 60000) {
      this.requestCount = 0;
    }

    // Check if we've exceeded the rate limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      console.warn('[WARN] Rate limit reached, waiting...');
      await new Promise(resolve => setTimeout(resolve, 60000 - timeSinceLastRequest));
    }

    // Ensure minimum interval between requests
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  async generateContent(request: UnifiedGenerateContentRequest): Promise<UnifiedGenerateContentResult> {
    try {
      await this.rateLimitCheck();

      // Convert request format for Gemini API
      const contents = request.contents.map(c => ({
        role: c.role === 'user' ? 'user' : 'model',
        parts: c.parts.map(p => {
          if (p.text) return { text: p.text };
          if (p.inlineData) return { inlineData: p.inlineData };
          if (p.fileData) return { fileData: p.fileData };
          return { text: '' };
        })
      }));

      const tools = request.tools || [];
      const generationConfig = request.generationConfig || {};

      // CRITICAL: Gemini API does NOT support responseMimeType: 'application/json' when tools are present.
      // Strip responseMimeType when tools are used to prevent "Tool use with a response mime type 'application/json' is unsupported" error.
      const hasTools = tools.length > 0;
      const effectiveMimeType = (!hasTools && generationConfig.responseMimeType === 'application/json')
        ? 'application/json'
        : undefined;

      const result = await this.geminiModel.generateContent({
        contents,
        ...(hasTools ? { tools } : {}),
        generationConfig: {
          ...generationConfig,
          responseMimeType: effectiveMimeType,
        }
      });

      const response = result.response;
      
      // If the model uses grounding, the response might be different, but for now we just care about the text
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Convert to unified format
      return {
        response: {
          candidates: [{
            content: {
              parts: [{ text }]
            }
          }]
        }
      };
    } catch (error: any) {
      console.error('[ERROR] Gemini API call failed:', error.message);
      throw error;
    }
  }
}

console.log('[INFO] Gemini API initialized with model:', textModel);

// Create unified models
export const generativeModel = new UnifiedModel(geminiTextModel);
export const generativeVisionModel = new UnifiedModel(geminiVisionModel);
export const groundedModel = new UnifiedModel(geminiTextModel);

// Model with custom search engine configuration
export const customSearchModel = (_searchEngineId: string) => {
  return new UnifiedModel(geminiTextModel);
};

// Helper function to get Gemini API models
export const getPreferredTextModel = () => generativeModel;
export const getPreferredVisionModel = () => generativeVisionModel;
