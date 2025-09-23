
import {VertexAI} from '@google-cloud/vertexai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

// Load environment variables
config();

// Validate required environment variables
const project = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION || 'us-central1';
const textModel = process.env.VERTEX_AI_TEXT_MODEL || 'gemini-2.5-pro';
const visionModel = process.env.VERTEX_AI_VISION_MODEL || 'gemini-2.5-pro';
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!project) {
  throw new Error('GCP_PROJECT_ID environment variable is required');
}

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

export const vertexAI = new VertexAI({project: project, location: location});

// Instantiate Gemini models
export const generativeModel = vertexAI.getGenerativeModel({
  model: textModel,
});

export const generativeVisionModel = vertexAI.getGenerativeModel({
  model: visionModel,
});

// Grounded model (no extra tools in config to avoid type issues)
export const groundedModel = vertexAI.getGenerativeModel({
    model: textModel,
});

// Model with custom search engine configuration
export const customSearchModel = (_searchEngineId: string) => vertexAI.getGenerativeModel({
    model: textModel,
});

// Initialize direct Gemini API client
export const geminiAI = new GoogleGenerativeAI(geminiApiKey);

// Direct Gemini API models (alternative to Vertex AI)
export const geminiTextModel = geminiAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
export const geminiVisionModel = geminiAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

// Helper function to choose between Vertex AI and direct Gemini API
export const getPreferredTextModel = () => {
  // Use Vertex AI by default, fallback to direct Gemini API if needed
  return generativeModel || geminiTextModel;
};

export const getPreferredVisionModel = () => {
  // Use Vertex AI by default, fallback to direct Gemini API if needed
  return generativeVisionModel || geminiVisionModel;
};
