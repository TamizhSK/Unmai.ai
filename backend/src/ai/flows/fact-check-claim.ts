
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

// Function to clean and parse potentially malformed JSON
function cleanAndParseJson(jsonString: string): any {
  // Remove markdown and trim
  let cleanJson = jsonString.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

  // Attempt to fix common JSON issues
  // 1. Replace single quotes with double quotes (be careful not to replace within strings)
  // This is a simplified approach. A more robust solution might use a proper parser,
  // but for common model mistakes, this can be effective.
  // It looks for : '...' and replaces the single quotes.
  cleanJson = cleanJson.replace(/'([^']*)'/g, '"$1"');
  
  // 2. Add quotes to unquoted keys.
  // This regex looks for unquoted keys (e.g., {key: "value"}) and adds quotes.
  cleanJson = cleanJson.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

  try {
    return JSON.parse(cleanJson);
  } catch (e) {
    // If parsing still fails, try to extract a JSON object from the string
    const jsonMatch = cleanJson.match(/\{.*\}/s);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (nestedError) {
        // Throw the original error if the extracted JSON is also invalid
        throw new Error(`Failed to parse extracted JSON: ${nestedError}`);
      }
    }
    // If no JSON object is found, throw the original error
    throw new Error(`Failed to parse JSON: ${e}`);
  }
}


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

  Your response must be a **valid JSON object** (not wrapped in markdown code blocks, no extra text) that strictly adheres to the following schema. The "source" field MUST be a full, valid URL.

  Example of a valid "evidence" item:
  {
    "source": "https://www.example.com/news/article-name",
    "title": "Example Article Title",
    "snippet": "A relevant quote or summary from the article..."
  }

  JSON Schema to follow (do not include markdown code block markers like \`\`\`json):
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
      explanation: `An error occurred during the fact-checking process: ${error instanceof Error ? error.message : 'Unknown error'}.`,
    };
  }
}
