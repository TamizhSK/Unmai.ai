import { VertexAI, GenerateContentRequest, GenerateContentResult } from '@google-cloud/vertexai';
import { GoogleGenerativeAI, GenerativeModel as GeminiModel } from '@google/generative-ai';
import { config } from 'dotenv';

// Load environment variables
config();

// Validate required environment variables
const project = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION || 'us-central1';
const textModel = process.env.VERTEX_AI_TEXT_MODEL || 'gemini-2.0-flash';
const visionModel = process.env.VERTEX_AI_VISION_MODEL || 'gemini-2.0-flash';
const geminiApiKey = process.env.GEMINI_API_KEY;
const isDevelopment = process.env.NODE_ENV === 'development';

if (!project) {
  throw new Error('GCP_PROJECT_ID environment variable is required');
}

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

// Initialize direct Gemini API client (works with API key)
export const geminiAI = new GoogleGenerativeAI(geminiApiKey);

// Direct Gemini API models (works with API key - use for local development)
export const geminiTextModel = geminiAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
export const geminiVisionModel = geminiAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Unified model wrapper that provides Vertex AI-compatible interface
 * but uses the Gemini API in development mode
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
  private vertexModel: ReturnType<VertexAI['getGenerativeModel']> | null = null;
  private useVertexAI: boolean;

  constructor(geminiModel: GeminiModel, vertexModel?: ReturnType<VertexAI['getGenerativeModel']> | null) {
    this.geminiModel = geminiModel;
    this.vertexModel = vertexModel || null;
    this.useVertexAI = !isDevelopment && this.vertexModel !== null;
  }

  async generateContent(request: UnifiedGenerateContentRequest): Promise<UnifiedGenerateContentResult> {
    if (this.useVertexAI && this.vertexModel) {
      // Use Vertex AI in production
      return this.vertexModel.generateContent(request as GenerateContentRequest) as Promise<UnifiedGenerateContentResult>;
    }

    // Use Gemini API in development
    try {
      // Convert Vertex AI format to Gemini API format
      const parts = request.contents[0]?.parts || [];
      const textParts = parts.map(p => {
        if (p.text) return p.text;
        if (p.inlineData) {
          return { inlineData: p.inlineData };
        }
        return '';
      }).filter(Boolean);

      const result = await this.geminiModel.generateContent(textParts as string[]);
      const response = await result.response;
      const text = response.text();

      // Convert to Vertex AI-compatible format
      return {
        response: {
          candidates: [{
            content: {
              parts: [{ text }]
            }
          }]
        }
      };
    } catch (error) {
      console.error('[ERROR] Gemini API call failed:', error);
      throw error;
    }
  }
}

// Vertex AI setup (requires GCP authentication - use for production)
let vertexAI: VertexAI | null = null;
let vertexGenerativeModel: ReturnType<VertexAI['getGenerativeModel']> | null = null;
let vertexVisionModel: ReturnType<VertexAI['getGenerativeModel']> | null = null;
let vertexGroundedModel: ReturnType<VertexAI['getGenerativeModel']> | null = null;

// Only initialize Vertex AI in production (when GCP auth is available)
if (!isDevelopment) {
  try {
    vertexAI = new VertexAI({ project: project, location: location });
    vertexGenerativeModel = vertexAI.getGenerativeModel({ model: textModel });
    vertexVisionModel = vertexAI.getGenerativeModel({ model: visionModel });
    vertexGroundedModel = vertexAI.getGenerativeModel({ model: textModel });
    console.log('[INFO] Vertex AI initialized for production');
  } catch (error) {
    console.warn('[WARN] Vertex AI initialization failed, using Gemini API fallback');
  }
} else {
  console.log('[INFO] Development mode - using Gemini API with API key');
}

// Create unified models that work in both environments
export const generativeModel = new UnifiedModel(geminiTextModel, vertexGenerativeModel);
export const generativeVisionModel = new UnifiedModel(geminiVisionModel, vertexVisionModel);
export const groundedModel = new UnifiedModel(geminiTextModel, vertexGroundedModel);

// Model with custom search engine configuration
export const customSearchModel = (_searchEngineId: string) => {
  if (vertexAI && !isDevelopment) {
    return new UnifiedModel(geminiTextModel, vertexAI.getGenerativeModel({ model: textModel }));
  }
  return new UnifiedModel(geminiTextModel);
};

// Helper function to choose between Vertex AI and direct Gemini API
export const getPreferredTextModel = () => generativeModel;
export const getPreferredVisionModel = () => generativeVisionModel;

// Export for backward compatibility
export { vertexAI };
