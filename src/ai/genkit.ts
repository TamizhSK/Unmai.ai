import {VertexAI} from '@google-cloud/vertexai';

const project = 'helpful-cat-465008-h1';
const location = 'us-central1';
const textModel = 'gemini-2.5-pro';
const visionModel = 'gemini-2.5-pro';

export const vertexAI = new VertexAI({project: project, location: location});

// Instantiate Gemini models
export const generativeModel = vertexAI.getGenerativeModel({
  model: textModel,
});

export const generativeVisionModel = vertexAI.getGenerativeModel({
  model: visionModel,
});
