'use server';
/**
 * @fileOverview Gets a credibility score for content.
 *
 * - getCredibilityScore - A function that gets a credibility score for content.
 * - GetCredibilityScoreInput - The input type for the getCredibilityScore function.
 * - GetCredibilityScoreOutput - The return type for the getCredibilityScore function.
 */

import {z} from 'zod';
import {generativeModel, generativeVisionModel} from '../genkit.js';
import {Part} from '@google-cloud/vertexai';

const GetCredibilityScoreInputSchema = z.object({
  content: z
    .string()
    .describe(
      'The content to analyze for credibility. If it is an image, it will be a data URI.'
    ),
  contentType: z
    .enum(['text', 'image', 'url'])
    .describe('The type of the content.'),
});
export type GetCredibilityScoreInput = z.infer<
  typeof GetCredibilityScoreInputSchema
>;

const GetCredibilityScoreOutputSchema = z.object({
  credibilityScore: z
    .number()
    .describe('A score representing the credibility of the content (0-100).'),
  assessmentSummary: z
    .string()
    .describe('A brief, factual summary of the main claims in the content (max 2 sentences).'),
  misleadingIndicators: z
    .array(z.string())
    .describe(
      'Specific indicators suggesting the content might be misleading.'
    ),
  source: z.string().describe("The source of the content (e.g., domain for URL, 'User Text', 'Uploaded Image').")
});
export type GetCredibilityScoreOutput = z.infer<
  typeof GetCredibilityScoreOutputSchema
>;

export async function getCredibilityScore(
  input: GetCredibilityScoreInput
): Promise<GetCredibilityScoreOutput> {
  let source: string;
  if (input.contentType === 'url') {
    try {
      const url = new URL(input.content);
      source = url.hostname;
    } catch (e) {
      source = 'Invalid URL';
    }
  } else if (input.contentType === 'text') {
    source = 'User Text';
  } else {
    source = 'Uploaded Image';
  }

  const textPrompt = `You are an AI assistant designed to assess the credibility of content.

  Analyze the following content. Identify the main claim, and provide a credibility score, a very brief factual summary of the assessment (max 2 sentences), and any misleading indicators. The content type is '${input.contentType}'.

  Content: ${input.content}

  Your response must be in the following JSON format:

  {
    "credibilityScore": number,     // A score from 0-100 indicating credibility
    "assessmentSummary": string,    // Brief factual summary (1-2 sentences)
    "misleadingIndicators": string[],  // Array of specific misleading elements found
    "source": string                // For URLs: domain name, for text: "User Text"
  }

  Example response:
  {
    "credibilityScore": 75,
    "assessmentSummary": "The article presents factual information with credible sources but includes some emotional language.",
    "misleadingIndicators": ["Use of emotional language", "Missing context for key claims"],
    "source": "example.com"
  }`;

  const imagePrompt = `You are an AI assistant designed to assess the credibility of images.

  Analyze the following image. Identify its main claim or message, and provide a credibility score, a very brief factual summary of your assessment (max 2 sentences), and any misleading indicators.

  Your response must be in the following JSON format:

  {
    "credibilityScore": number,     // A score from 0-100 indicating credibility
    "assessmentSummary": string,    // Brief factual summary (1-2 sentences)
    "misleadingIndicators": string[],  // Array of specific manipulation or misleading elements
    "source": string                // Should always be "Uploaded Image"
  }

  Example response:
  {
    "credibilityScore": 30,
    "assessmentSummary": "The image shows signs of digital manipulation in lighting and shadows.",
    "misleadingIndicators": ["Inconsistent lighting", "Unnatural shadows", "Blurred edges"],
    "source": "Uploaded Image"
  }`;

  let result;
  if (input.contentType === 'image') {
    const [mimeType, base64Data] = input.content.split(';base64,');
    const imagePart: Part = {
      inlineData: {
        mimeType: mimeType.replace('data:', ''),
        data: base64Data,
      },
    };
    result = await generativeVisionModel.generateContent({
      contents: [{role: 'user', parts: [imagePart, {text: imagePrompt}]}],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });
  } else {
    result = await generativeModel.generateContent({
      contents: [{role: 'user', parts: [{text: textPrompt}]}],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });
  }

  const response = result.response;

  if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid or empty response received from the model');
  }

  const responseText = response.candidates[0].content.parts[0].text.trim();

  try {
    const parsedJson = safeJsonParse(responseText);
    if (!parsedJson) throw new Error('Parsing failed');
    const validatedOutput = GetCredibilityScoreOutputSchema.parse(parsedJson as any);
    validatedOutput.source = source;
    return validatedOutput;
  } catch (error) {
    console.error('[ERROR] Error parsing or validating model output:', error);
    console.error('[ERROR] Raw response for debugging:', responseText);
    return {
      credibilityScore: 0,
      assessmentSummary: 'The model returned a response that was not in the expected JSON format.',
      misleadingIndicators: [],
      source: source,
    };
  }
}

// Helper: attempts to parse JSON, returns object or null
function safeJsonParse(raw: string): any | null {
  // Remove markdown fences
  let txt = raw.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
  // Quick first attempt
  try {
    return JSON.parse(txt);
  } catch { /* ignore */ }
  // Minimal fixes: collapse double quotes and remove control chars
  txt = txt
    .replace(/"{2,}/g, '"')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/,\s*([}\]])/g, '$1');
  // Second attempt
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}