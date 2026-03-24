import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from 'dotenv';

// Load environment variables
config();

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

// Initialize Vertex AI for GCP APIs (Vision, Video Intelligence, etc.)
export const vertexAI = new VertexAI({ project, location });

// Initialize direct Gemini API client for text/vision generation
export const geminiAI = new GoogleGenerativeAI(geminiApiKey);

// Direct Gemini API models with safety settings disabled for content analysis
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

// Use Gemini API models directly
export const generativeModel = geminiTextModel;
export const generativeVisionModel = geminiVisionModel;
export const groundedModel = geminiTextModel;

// Model with custom search engine configuration
export const customSearchModel = (_searchEngineId: string) => geminiTextModel;

// Helper function to get Gemini API models
export const getPreferredTextModel = () => geminiTextModel;
export const getPreferredVisionModel = () => geminiVisionModel;
