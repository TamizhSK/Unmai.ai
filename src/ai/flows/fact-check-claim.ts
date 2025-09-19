
'use server';
/**
 * @fileOverview Fact-checks a given claim using a grounded model.
 *
 * - factCheckClaim - A function that fact-checks a claim.
 * - FactCheckClaimInput - The input type for the factCheckClaim function.
 * - FactCheckClaimOutput - The return type for the factCheckClaim function.
 */

import {z} from 'zod';
import {groundedModel} from '@/ai/genkit';

const FactCheckClaimInputSchema = z.object({
  claim: z.string().describe('The claim to be fact-checked.'),
});
export type FactCheckClaimInput = z.infer<typeof FactCheckClaimInputSchema>;

const FactCheckClaimOutputSchema = z.object({
  verdict: z.enum(['True', 'False', 'Misleading', 'Uncertain']).describe('The verdict of the fact-check.'),
  evidence: z.array(z.object({
    source: z.string().url().describe('The URL of the evidence source.'),
    title: z.string().describe('The title of the source page.'),
    snippet: z.string().describe('A relevant snippet from the source.'),
  })).describe('A list of sources that support the verdict.'),
  explanation: z.string().describe('A detailed explanation of the fact-check result.'),
});
export type FactCheckClaimOutput = z.infer<typeof FactCheckClaimOutputSchema>;

export async function factCheckClaim(
  input: FactCheckClaimInput
): Promise<FactCheckClaimOutput> {
  const prompt = `You are a professional fact-checker. Your task is to verify the following claim with the highest level of accuracy and neutrality.

  Claim: "${input.claim}"

  1.  **Search the web** for reliable and diverse sources to assess the claim.
  2.  **Analyze the evidence** you find, looking for corroboration and conflicts.
  3.  **Formulate a verdict**: "True", "False", "Misleading", or "Uncertain".
  4.  **Provide a clear explanation** for your verdict, summarizing the evidence.
  5.  **Cite your sources** by providing a list of URLs, titles, and relevant snippets.

  Your response must be a JSON object that strictly adheres to the following schema. The "source" field MUST be a full, valid URL.

  Example of a valid "evidence" item:
  {
    "source": "https://www.example.com/news/article-name",
    "title": "Example Article Title",
    "snippet": "A relevant quote or summary from the article..."
  }

  JSON Schema to follow:
  {
    "verdict": "...",
    "evidence": [
      {
        "source": "...",
        "title": "...",
        "snippet": "..."
      }
    ],
    "explanation": "..."
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
    const cleanJson = responseText.replace(/^`\s*json\s*/, '').replace(/`\s*$/, '').trim();
    const parsedJson = JSON.parse(cleanJson);
    
    return FactCheckClaimOutputSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error in fact-checking claim:', error);
    return {
      verdict: 'Uncertain',
      evidence: [],
      explanation: `An error occurred during the fact-checking process: ${error instanceof Error ? error.message : 'Unknown error'}.`,
    };
  }
}
