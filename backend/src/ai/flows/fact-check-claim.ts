
'use server';
/**
 * @fileOverview Fact-checks a claim.
 *
 * - factCheckClaim - A function that fact-checks a claim.
 * - FactCheckClaimInput - The input type for the factCheckClaim function.
 * - FactCheckClaimOutput - The return type for the factCheckClaim function.
 */

import {z} from 'zod';
import {groundedModel} from '../genkit.js';

const FactCheckClaimInputSchema = z.object({
  claim: z.string().describe('The claim to be fact-checked.'),
});
export type FactCheckClaimInput = z.infer<typeof FactCheckClaimInputSchema>;

const FactCheckClaimOutputSchema = z.object({
  verdict: z.enum(['True', 'False', 'Misleading', 'Uncertain']).describe('The verdict of the fact-check.'),
  evidence: z.array(z.object({
    source: z.string().describe('The source type or recommended verification method.'),
    title: z.string().describe('The title or verification method description.'),
    snippet: z.string().describe('Key points to look for when verifying this claim.'),
  })).describe('A list of source recommendations and verification guidance.'),
  explanation: z.string().describe('A detailed explanation of the fact-check result.'),
});
export type FactCheckClaimOutput = z.infer<typeof FactCheckClaimOutputSchema>;

// Function to clean and parse potentially malformed JSON or extract structured info from text
function cleanAndParseJson(responseText: string): any {
  // First, try to find JSON in the response
  let cleanJson = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/gi, '')
    .replace(/```$/gm, '')
    .trim();

  // Look for JSON object boundaries
  const jsonStart = cleanJson.indexOf('{');
  let jsonEnd = cleanJson.lastIndexOf('}');

  // If no closing brace found, try to reconstruct the JSON
  if (jsonStart !== -1 && jsonEnd === -1) {
    console.warn('[WARN] Incomplete JSON detected in fact-check, attempting to reconstruct');
    // Fallback: just add closing brace
    cleanJson = cleanJson.substring(jsonStart) + '}';
    jsonEnd = cleanJson.length - 1;
  } else if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd < jsonStart) {
    console.warn('[WARN] Malformed JSON detected in fact-check, attempting to reconstruct');
    // Fallback: remove all characters after the opening brace
    cleanJson = cleanJson.substring(0, jsonStart + 1) + '}';
    jsonEnd = cleanJson.length - 1;
  }

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);

    // Fix common JSON formatting issues
    cleanJson = cleanJson
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/\"(?=\s*:)/g, '"') // Remove backslash before quote in a key
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Quote unquoted keys
      .replace(/:\s*'([^'\\]*(\\.[^'\\]*)*)'/g, ': "$1"') // Convert single quotes to double
      // Fix control characters and newlines
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\r/g, '\\r') // Escape carriage returns
      .replace(/\t/g, '\\t') // Escape tabs
      // Fix unescaped quotes in string values (more robust approach)
      .replace(/"([^"\\]*)\\?"([^"\\]*)"([^"\\]*)"(\s*[,}])/g, '"$1\\"$2\\"$3"$4')
      // Fix incomplete strings at end of object
      .replace(/"\s*$/, '"}');

    try {
      return JSON.parse(cleanJson);
    } catch (e) {
      console.log('JSON parsing failed, trying text extraction. Error:', e);
      console.log('Failed JSON:', cleanJson.substring(0, 500));
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
  const sentences = explanation.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
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
  const prompt = `You are a professional fact-checker with access to comprehensive knowledge. Analyze this claim and provide a definitive, factual assessment.

Claim: "${input.claim}"

ANALYSIS REQUIREMENTS:
1. Use your extensive training knowledge to evaluate this claim factually
2. Be decisive - avoid "Uncertain" unless the claim is genuinely ambiguous
3. For well-established facts, mark as "True"
4. For clearly false information, mark as "False" 
5. For partially correct but misleading claims, mark as "Misleading"
6. Provide specific, factual explanations with concrete details

RESPONSE FORMAT - ONLY VALID JSON:
{
  "verdict": "True|False|Misleading|Uncertain",
  "explanation": "Factual explanation with specific details and context",
  "evidence": [
    {
      "source": "Authoritative source type",
      "title": "Specific resource name",
      "snippet": "What evidence to look for"
    },
    {
      "source": "Government or academic source",
      "title": "Official documentation",
      "snippet": "Key verification points"
    },
    {
      "source": "Fact-checking organization",
      "title": "Verification resource",
      "snippet": "How to confirm the facts"
    }
  ]
}

CRITICAL RULES:
- Use only double quotes, no single quotes
- No line breaks in strings - use spaces
- No markdown or code blocks
- Be factual and decisive in your verdict
- Provide concrete, specific explanations`;

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
    
    // Parse and validate the response using Zod schema
    const validatedResult = FactCheckClaimOutputSchema.parse(parsedJson);
    return validatedResult;
  } catch (error) {
    console.error('[ERROR] Fact-check analysis failed:', error);
    
    // Handle Zod validation errors specifically
    if (error?.constructor?.name === 'ZodError') {
      console.error('[ERROR] Zod validation failed:', (error as any)?.issues);
      console.error('Response that failed validation:', response?.candidates?.[0]?.content?.parts?.[0]?.text);
      
      // Try to use the cleanAndParseJson fallback for malformed responses
      try {
        const fallbackResult = cleanAndParseJson(response?.candidates?.[0]?.content?.parts?.[0]?.text || '');
        
        // Create a safe fallback with proper structure
        return {
          verdict: fallbackResult?.verdict || 'Uncertain',
          evidence: Array.isArray(fallbackResult?.evidence) ? 
            fallbackResult.evidence.map((item: any) => ({
              source: String(item?.source || 'Knowledge base analysis'),
              title: String(item?.title || 'AI assessment'),
              snippet: String(item?.snippet || 'Based on training knowledge')
            })) : [{
              source: 'AI knowledge assessment',
              title: 'Analysis based on training data',
              snippet: 'Claim analyzed using available knowledge base'
            }],
          explanation: String(fallbackResult?.explanation || 'Analysis completed but requires further manual verification.')
        };
      } catch (fallbackError) {
        console.error('[ERROR] Fallback parsing also failed:', fallbackError);
      }
    }
    
    // Final fallback for any other errors
    return {
      verdict: 'Uncertain' as const,
      evidence: [
        {
          source: 'Fact-checking websites',
          title: 'Snopes, FactCheck.org, PolitiFact',
          snippet: 'Visit established fact-checking websites to search for information about this claim. These sites provide detailed analysis and source citations.'
        },
        {
          source: 'Academic databases',
          title: 'Google Scholar, PubMed, JSTOR',
          snippet: 'Search academic databases for peer-reviewed research related to this topic. Look for systematic reviews and meta-analyses for the most comprehensive evidence.'
        },
        {
          source: 'Government sources',
          title: 'Official government websites and statistics',
          snippet: 'Check official government websites (.gov domains) for authoritative data and policy information related to this claim.'
        }
      ],
      explanation: 'The fact-check analysis requires additional verification. The claim could not be definitively confirmed or denied based on available information. Please consult the suggested sources for more detailed verification.',
    };
  }
}
