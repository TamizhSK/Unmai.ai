'use server';

/**
 * @fileOverview Verifies the source and origin of content using web grounding.
 *
 * - verifySource - A function that verifies the source and origin of content.
 * - VerifySourceInput - The input type for the verifySource function.
 * - VerifySourceOutput - The return type for the verifySource function.
 */

import {z} from 'zod';
import {groundedModel} from '@/ai/genkit';

const VerifySourceInputSchema = z.object({
  content: z.string().describe('The content to verify the source and origin for.'),
  contentType: z.enum(['text', 'url']).describe('The type of the content.'),
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

  const prompt = `You are an expert in source verification and fact-checking.

  Analyze the following ${input.contentType} content and verify its source and origin using your web grounding capabilities.
  Content: ${input.content}

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
    }]
  }
  
  Example response:
  {
    "sourceVerified": true,
    "originTraced": true,
    "sourceCredibility": 85,
    "verificationDetails": "The content originated from a reputable news source...",
    "relatedSources": [
      {
        "url": "https://example.com/article",
        "title": "Related Article Title",
        "similarity": 90
      }
    ]
  }`;

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