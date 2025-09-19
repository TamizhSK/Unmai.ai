
'use server';
/**
 * @fileOverview Fact-checks a claim.
 *
 * - factCheckClaim - A function that fact-checks a claim.
 * - FactCheckClaimInput - The input type for the factCheckClaim function.
 * - FactCheckClaimOutput - The return type for the factCheckClaim function.
 */

import {z} from 'zod';
import {groundedModel} from '../genkit';

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

// Function to clean and parse potentially malformed JSON or extract structured info from text
function cleanAndParseJson(responseText: string): any {
  // First, try to find JSON in the response
  let cleanJson = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/gi, '')
    .replace(/^```/gm, '')
    .replace(/```$/gm, '')
    .trim();

  // Look for JSON object boundaries
  const jsonStart = cleanJson.indexOf('{');
  const jsonEnd = cleanJson.lastIndexOf('}');
  
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
    
    // Fix common JSON formatting issues
    cleanJson = cleanJson
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^'\\]*(\\.[^'\\]*)*)'/g, ': "$1"');

    try {
      return JSON.parse(cleanJson);
    } catch (e) {
      console.log('JSON parsing failed, trying text extraction');
    }
  }

  // If JSON parsing fails, extract information from the text
  const text = responseText.toLowerCase();
  let verdict = 'Uncertain';
  
  // Determine verdict from text content
  if (text.includes('false') || text.includes('incorrect') || text.includes('not true')) {
    verdict = 'False';
  } else if (text.includes('true') || text.includes('correct') || text.includes('accurate')) {
    verdict = 'True';
  } else if (text.includes('misleading') || text.includes('partially') || text.includes('mixed')) {
    verdict = 'Misleading';
  }

  // Create a clean, concise explanation
  let explanation = responseText;
  
  // Remove reference numbers like [1], [2], etc.
  explanation = explanation.replace(/\[\d+(?:,\s*\d+)*\]/g, '');
  
  // Split into sentences and take the first few that are substantial
  const sentences = explanation.split(/[.!?]+/).filter(s => s.trim().length > 20);
  explanation = sentences.slice(0, 3).join('. ').trim();
  
  // Ensure it ends with a period
  if (explanation && !explanation.endsWith('.')) {
    explanation += '.';
  }

  // Limit explanation length
  if (explanation.length > 300) {
    explanation = explanation.substring(0, 297) + '...';
  }

  return {
    verdict,
    evidence: [],
    explanation: explanation || 'The claim has been analyzed but requires further verification.'
  };
}


export async function factCheckClaim(
  input: FactCheckClaimInput
): Promise<FactCheckClaimOutput> {
  const prompt = `You are a professional fact-checker. Analyze this claim and provide a clear, concise verdict.

Claim: "${input.claim}"

Instructions:
1. Search for reliable sources to verify this claim
2. Determine if the claim is True, False, Misleading, or Uncertain
3. Provide a brief, clear explanation (2-3 sentences maximum)
4. Include relevant evidence sources

CRITICAL: Respond ONLY with valid JSON. No markdown, no extra text.

Required format:
{
  "verdict": "True|False|Misleading|Uncertain",
  "explanation": "Brief, clear explanation in 2-3 sentences",
  "evidence": [
    {
      "source": "https://reliable-source.com",
      "title": "Source Title",
      "snippet": "Key quote supporting the verdict"
    }
  ]
}

Keep explanations concise and factual. Focus on the most important evidence.`;

  let response;
  try {
    const result = await groundedModel.generateContent({
      contents: [{role: 'user', parts: [{text: prompt}]}],
    });

    response = result.response;
    
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid or empty response received from the model');
    }

    const responseText = response.candidates[0].content.parts[0].text;
    
    if (!responseText) {
      throw new Error('Empty response received from the model');
    }
    
    const parsedJson = cleanAndParseJson(responseText);
    
    return FactCheckClaimOutputSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error in fact-checking claim:', error);
    if (error instanceof Error && (error.message.includes('JSON') || error instanceof SyntaxError)) {
      console.error('Response text that failed to parse:', response?.candidates?.[0]?.content?.parts?.[0]?.text);
    }
    return {
      verdict: 'Uncertain',
      evidence: [],
      explanation: 'Unable to complete fact-check analysis at this time. Please try again or rephrase your claim.',
    };
  }
}
