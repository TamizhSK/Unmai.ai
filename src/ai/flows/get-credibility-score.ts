'use server';
/**
 * @fileOverview AI agent to get a credibility score for a given piece of content.
 *
 * - getCredibilityScore - A function that handles the process of getting a credibility score for content.
 * - GetCredibilityScoreInput - The input type for the getCredibilityScore function.
 * - GetCredibilityScoreOutput - The return type for the getCredibilityScore function.
 */

import {z} from 'zod';
import {generativeModel, generativeVisionModel} from '@/ai/genkit';
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

  If the content is a URL, extract and return the domain as the 'source'.
  If the content is plain text, return 'User Text' as the 'source'.

  Respond in a structured JSON format.
  `;

  const imagePrompt = `You are an AI assistant designed to assess the credibility of images.

  Analyze the following image. Identify its main claim or message, and provide a credibility score, a very brief factual summary of your assessment (max 2 sentences), and any misleading indicators.

  Return 'Uploaded Image' as the 'source'.
  
  Respond in a structured JSON format.
  `;

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
  const responseText = response.candidates[0].content.parts[0].text;

  if (!responseText) {
    throw new Error('No response text received from the model');
  }

  try {
    const parsedJson = JSON.parse(responseText);
    const validatedOutput = GetCredibilityScoreOutputSchema.parse(parsedJson);
    validatedOutput.source = source; // Ensure the source is correctly set
    return validatedOutput;
  } catch (error) {
    console.error('Error parsing or validating model output:', error);
    return {
      credibilityScore: 0,
      assessmentSummary: 'The model returned a response that was not in the expected JSON format.',
      misleadingIndicators: [],
      source: source,
    };
  }
}