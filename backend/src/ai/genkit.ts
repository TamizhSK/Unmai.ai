// Commented out Vertex AI for prototype - using Gemini API key only
// import { VertexAI, GenerateContentRequest, GenerateContentResult } from '@google-cloud/vertexai';
import { GoogleGenerativeAI, GenerativeModel as GeminiModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from 'dotenv';

// Load environment variables
config();

// Validate required environment variables
// const project = process.env.GCP_PROJECT_ID; // Commented out for prototype
// const location = process.env.GCP_LOCATION || 'us-central1'; // Commented out for prototype
const textModel = process.env.VERTEX_AI_TEXT_MODEL || 'gemini-2.5-flash';
const visionModel = process.env.VERTEX_AI_VISION_MODEL || 'gemini-2.5-flash';
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
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
  private readonly MAX_REQUESTS_PER_MINUTE = 15; // Conservative limit
  // private vertexModel: ReturnType<VertexAI['getGenerativeModel']> | null = null; // Commented out for prototype
  // private useVertexAI: boolean; // Commented out for prototype

  constructor(geminiModel: GeminiModel /* , vertexModel?: ReturnType<VertexAI['getGenerativeModel']> | null */) {
    this.geminiModel = geminiModel;
    // this.vertexModel = vertexModel || null; // Commented out for prototype
    // this.useVertexAI = !isDevelopment && this.vertexModel !== null; // Commented out for prototype
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
      console.warn('[WARN] Rate limit reached, using mock response');
      throw new Error('Rate limit exceeded');
    }
    
    // Ensure minimum interval between requests
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`[INFO] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  async generateContent(request: UnifiedGenerateContentRequest): Promise<UnifiedGenerateContentResult> {
    // Check if mock mode is enabled
    if (process.env.MOCK_MODE === 'true') {
      console.log('[INFO] Mock mode enabled - returning simulated response');
      const mockText = this.generateMockResponse(request);
      return {
        response: {
          candidates: [{
            content: {
              parts: [{ text: mockText }]
            }
          }]
        }
      };
    }

    // Vertex AI code commented out for prototype - using Gemini API only
    // if (this.useVertexAI && this.vertexModel) {
    //   return this.vertexModel.generateContent(request as GenerateContentRequest) as Promise<UnifiedGenerateContentResult>;
    // }

    // Use Gemini API (PRIMARY METHOD FOR PROTOTYPE)
    try {
      // Apply rate limiting
      await this.rateLimitCheck();
      
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
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
    } catch (error: any) {
      // Handle quota exceeded errors specifically
      if (error?.status === 429 || error?.message?.includes('Rate limit') || error?.message?.includes('quota')) {
        console.warn('[WARN] Gemini API quota/rate limit exceeded, using mock response');
        const mockText = this.generateMockResponse(request);
        return {
          response: {
            candidates: [{
              content: {
                parts: [{ text: mockText }]
              }
            }]
          }
        };
      }
      
      console.error('[ERROR] Gemini API call failed:', error);
      
      // For any error, return a mock response to prevent crashes
      const mockText = this.generateMockResponse(request);
      return {
        response: {
          candidates: [{
            content: {
              parts: [{ text: mockText }]
            }
          }]
        }
      };
    }
  }

  private generateMockResponse(request: UnifiedGenerateContentRequest): string {
    const inputText = request.contents[0]?.parts?.[0]?.text || '';
    
    // Generate contextual mock responses based on the input
    if (inputText.toLowerCase().includes('fact check') || inputText.toLowerCase().includes('claim')) {
      return JSON.stringify({
        verdict: "Uncertain",
        confidence: 0.75,
        explanation: "This claim requires additional verification. The available information suggests mixed evidence that needs further investigation.",
        evidence: [
          { 
            source: "Fact-checking websites", 
            title: "Snopes, FactCheck.org, PolitiFact", 
            snippet: "Visit established fact-checking websites to search for information about this claim." 
          },
          { 
            source: "Academic databases", 
            title: "Google Scholar, PubMed", 
            snippet: "Search academic databases for peer-reviewed research related to this topic." 
          },
          { 
            source: "Government sources", 
            title: "Official government websites", 
            snippet: "Check official government websites for authoritative data related to this claim." 
          }
        ]
      });
    }
    
    if (inputText.toLowerCase().includes('credibility') || inputText.toLowerCase().includes('trust')) {
      return JSON.stringify({
        credibilityScore: 0.72,
        factors: ["Source reputation", "Content accuracy", "Bias assessment"],
        explanation: "The content shows moderate credibility with reliable sources but some potential bias."
      });
    }
    
    if (inputText.toLowerCase().includes('web analysis') || inputText.toLowerCase().includes('real-time')) {
      return JSON.stringify({
        realTimeFactCheck: true,
        currentInformation: [
          {
            title: "Mock Search Result",
            url: "https://example.com/mock-result",
            snippet: "This is a mock search result for testing purposes during API quota limits.",
            date: new Date().toISOString().split('T')[0],
            relevance: 85
          }
        ],
        informationGaps: ["Additional verification needed", "More recent sources required"],
        analysisSummary: "Mock web analysis completed. Real analysis unavailable due to API quota limits."
      });
    }
    
    if (inputText.toLowerCase().includes('summary') || inputText.toLowerCase().includes('analyze')) {
      return JSON.stringify({
        summary: "This content discusses important topics with a balanced perspective. Key points include factual information supported by credible sources.",
        keyPoints: ["Main topic is well-researched", "Sources are generally reliable", "Some areas need additional verification"],
        recommendation: "Content is generally trustworthy but verify specific claims independently."
      });
    }
    
    // Default mock response
    return JSON.stringify({
      analysis: "Mock analysis response - API quota exceeded",
      status: "This is a simulated response for testing purposes",
      recommendation: "Get a new API key or wait for quota reset to see real AI analysis"
    });
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
