'use server';
/**
 * @fileOverview Verifies the source of content.
 *
 * - verifySource - A function that verifies the source of content.
 * - VerifySourceInput - The input type for the verifySource function.
 * - VerifySourceOutput - The return type for the verifySource function.
 */

import {z} from 'zod';
import {groundedModel} from '../genkit.js';

const VerifySourceInputSchema = z.object({
  content: z.string().describe('The content to verify the source and origin for.'),
  contentType: z.enum(['text', 'url', 'media']).describe('The type of the content.'),
});
export type VerifySourceInput = z.infer<typeof VerifySourceInputSchema>;

const VerifySourceOutputSchema = z.object({
  sourceVerified: z.boolean().describe('Whether the source was verified.'),
  originTraced: z.boolean().describe('Whether the origin was traced.'),
  sourceCredibility: z.number().min(0).max(100).describe('A credibility score for the source (0-100).'),
  verificationDetails: z.string().describe('Detailed explanation of the verification process and findings.'),
  relatedSources: z.array(z.object({
    url: z.string(),
    title: z.string(),
    similarity: z.number().min(0).max(100),
  })).describe('Related sources found during verification.'),
  originalSource: z.object({
    url: z.string(),
    title: z.string(),
    snippet: z.string(),
  }).optional().describe('The original source of the content.'),
});
export type VerifySourceOutput = z.infer<typeof VerifySourceOutputSchema>;

export async function verifySource(
  input: VerifySourceInput
): Promise<VerifySourceOutput> {
  let source = 'Unknown';
  if (input.contentType === 'url') {
    try {
      const url = new URL(input.content);
      source = url.hostname;
    } catch (e) {
      source = 'Invalid URL';
    }
  } else {
    source = 'User Text';
  }

  let prompt;
  if (input.contentType === 'url') {
    prompt = `You are an expert in source verification and fact-checking.

Analyze the following URL and verify its source and origin using your web grounding capabilities.
URL: ${input.content}

Perform the following tasks:
1. Verify the credibility of the source "${source}"
2. Trace the origin of the content if possible
3. Find related sources that discuss similar content
4. Provide a credibility score for the source (0-100)

Your response must be in the following JSON format:
{
  "sourceVerified": boolean,
  "originTraced": boolean,
  "sourceCredibility": number,
  "verificationDetails": string,
  "relatedSources": [{
    "url": string,
    "title": string,
    "similarity": number
  }],
  "originalSource": {
    "url": string,
    "title": string,
    "snippet": string
  }
}`;
  } else if (input.contentType === 'text') {
    prompt = `You are an expert in source verification and fact-checking.

Analyze the following text and find its original source using your web grounding capabilities.
Text: "${input.content}"

Perform the following tasks:
1. Find the original source of the text.
2. Verify the credibility of the source.
3. Trace the origin of the content if possible.
4. Find related sources that discuss similar content.
5. Provide a credibility score for the source (0-100).

Your response must be in the following JSON format:
{
  "sourceVerified": boolean,
  "originTraced": boolean,
  "sourceCredibility": number,
  "verificationDetails": string,
  "relatedSources": [{
    "url": string,
    "title": string,
    "similarity": number
  }],
  "originalSource": {
    "url": string,
    "title": string,
    "snippet": string
  }
}`;
  } else { // media
    prompt = `You are an expert in source verification and fact-checking.

Analyze the following media content and find its original source using your web grounding capabilities.
Content: ${input.content}

Perform the following tasks:
1. Perform a reverse image search or search for the file's metadata to find the original source of the media.
2. Verify the credibility of the source.
3. Trace the origin of the content if possible.
4. Find related sources that discuss similar content.
5. Provide a credibility score for the source (0-100).

Your response must be in the following JSON format:
{
  "sourceVerified": boolean,
  "originTraced": boolean,
  "sourceCredibility": number,
  "verificationDetails": string,
  "relatedSources": [{
    "url": string,
    "title": string,
    "similarity": number
  }],
  "originalSource": {
    "url": string,
    "title": string,
    "snippet": string
  }
}`;
  }
  try {
    const result = await groundedModel.generateContent({
      contents: [{role: 'user', parts: [{text: prompt}]}],
    });

    const response = result.response;
    
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid or empty response received from the model');
    }

    const responseText = response.candidates[0].content.parts[0].text;

    // Clean up the response text by removing markdown code block markers if present
    const cleanJson = responseText
      .replace(/^```json\s*/, '')  // Remove opening ```json
      .replace(/```\s*$/, '')      // Remove closing ```
      .trim();                     // Remove any extra whitespace

    const parsedJson = JSON.parse(cleanJson);
    return VerifySourceOutputSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error in source verification:', error);
    return {
      sourceVerified: false,
      originTraced: false,
      sourceCredibility: 0,
      verificationDetails: `Failed to verify source: ${error instanceof Error ? error.message : 'Unknown error'}`,
      relatedSources: [],
    };
  }
}