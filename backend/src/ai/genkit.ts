// Commented out Vertex AI for prototype - using Gemini API key only
// import { VertexAI, GenerateContentRequest, GenerateContentResult } from '@google-cloud/vertexai';
import { GoogleGenerativeAI, GenerativeModel as GeminiModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from 'dotenv';

// Load environment variables
config();

// Validate required environment variables
// const project = process.env.GCP_PROJECT_ID; // Commented out for prototype
// const location = process.env.GCP_LOCATION || 'us-central1'; // Commented out for prototype
const textModel = process.env.VERTEX_AI_TEXT_MODEL || 'gemini-2.0-flash-exp';
const visionModel = process.env.VERTEX_AI_VISION_MODEL || 'gemini-2.0-flash-exp';
const geminiApiKey = process.env.GEMINI_API_KEY;
const isDevelopment = process.env.NODE_ENV === 'development';

// Commented out for prototype - GCP not needed when using Gemini API key
// if (!project) {
//   throw new Error('GCP_PROJECT_ID environment variable is required');
// }

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

// Initialize direct Gemini API client (works with API key) - PRIMARY METHOD FOR PROTOTYPE
export const geminiAI = new GoogleGenerativeAI(geminiApiKey);

// Direct Gemini API models (works with API key) - USING LATEST EXPERIMENTAL MODEL
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
 * Unified model wrapper that uses Gemini API exclusively for prototype
 * Vertex AI code commented out due to ongoing GCP issues
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
  // private vertexModel: ReturnType<VertexAI['getGenerativeModel']> | null = null; // Commented out for prototype
  // private useVertexAI: boolean; // Commented out for prototype

  constructor(geminiModel: GeminiModel /* , vertexModel?: ReturnType<VertexAI['getGenerativeModel']> | null */) {
    this.geminiModel = geminiModel;
    // this.vertexModel = vertexModel || null; // Commented out for prototype
    // this.useVertexAI = !isDevelopment && this.vertexModel !== null; // Commented out for prototype
  }

  async generateContent(request: UnifiedGenerateContentRequest): Promise<UnifiedGenerateContentResult> {
    // Vertex AI code commented out for prototype - using Gemini API only
    // if (this.useVertexAI && this.vertexModel) {
    //   return this.vertexModel.generateContent(request as GenerateContentRequest) as Promise<UnifiedGenerateContentResult>;
    // }

    // Use Gemini API (PRIMARY METHOD FOR PROTOTYPE)
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

// Vertex AI setup commented out for prototype - using Gemini API only
// let vertexAI: VertexAI | null = null;
// let vertexGenerativeModel: ReturnType<VertexAI['getGenerativeModel']> | null = null;
// let vertexVisionModel: ReturnType<VertexAI['getGenerativeModel']> | null = null;
// let vertexGroundedModel: ReturnType<VertexAI['getGenerativeModel']> | null = null;

// Vertex AI initialization commented out due to ongoing GCP issues
// if (!isDevelopment) {
//   try {
//     vertexAI = new VertexAI({ project: project, location: location });
//     vertexGenerativeModel = vertexAI.getGenerativeModel({ model: textModel });
//     vertexVisionModel = vertexAI.getGenerativeModel({ model: visionModel });
//     vertexGroundedModel = vertexAI.getGenerativeModel({ model: textModel });
//     console.log('[INFO] Vertex AI initialized for production');
//   } catch (error) {
//     console.warn('[WARN] Vertex AI initialization failed, using Gemini API fallback');
//   }
// } else {
//   console.log('[INFO] Development mode - using Gemini API with API key');
// }

console.log('[INFO] PROTOTYPE MODE - Using Gemini API with API key exclusively');

// Create unified models using Gemini API only (Vertex AI disabled for prototype)
export const generativeModel = new UnifiedModel(geminiTextModel);
export const generativeVisionModel = new UnifiedModel(geminiVisionModel);
export const groundedModel = new UnifiedModel(geminiTextModel);

// Model with custom search engine configuration (Gemini API only)
export const customSearchModel = (_searchEngineId: string) => {
  return new UnifiedModel(geminiTextModel);
};

// Helper function to get Gemini API models (Vertex AI disabled for prototype)
export const getPreferredTextModel = () => generativeModel;
export const getPreferredVisionModel = () => generativeVisionModel;

// Export null for backward compatibility (Vertex AI disabled for prototype)
export const vertexAI = null;
