// Commented out Vertex AI for prototype - using Gemini API key only
// import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from 'dotenv';

// Load environment variables
config();

// Validate required environment variables
// const project = process.env.GCP_PROJECT_ID; // Commented out for prototype
// const location = process.env.GCP_LOCATION || 'us-central1'; // Commented out for prototype
const textModel = process.env.VERTEX_AI_TEXT_MODEL || 'gemini-2.0-flash-exp';
const visionModel = process.env.VERTEX_AI_VISION_MODEL || 'gemini-2.0-flash-exp';
const geminiApiKey = process.env.GEMINI_API_KEY;

// Commented out for prototype - GCP not needed when using Gemini API key
// if (!project) {
//   throw new Error('GCP_PROJECT_ID environment variable is required');
// }

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

// Vertex AI disabled for prototype
// export const vertexAI = new VertexAI({ project: project, location: location });
export const vertexAI = null; // Disabled for prototype

// Initialize direct Gemini API client (PRIMARY METHOD FOR PROTOTYPE)
export const geminiAI = new GoogleGenerativeAI(geminiApiKey);

// Direct Gemini API models with safety settings disabled for prototype
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

// Use Gemini API models directly (Vertex AI disabled for prototype)
export const generativeModel = geminiTextModel;
export const generativeVisionModel = geminiVisionModel;
export const groundedModel = geminiTextModel;

// Model with custom search engine configuration (Gemini API only)
export const customSearchModel = (_searchEngineId: string) => geminiTextModel;

// Helper function to get Gemini API models (Vertex AI disabled for prototype)
export const getPreferredTextModel = () => geminiTextModel;
export const getPreferredVisionModel = () => geminiVisionModel;
