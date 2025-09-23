'use server';
/**
 * @fileOverview Fact-checks a claim.
 *
 * - factCheckClaim - A function that fact-checks a claim.
 * - FactCheckClaimInput - The input type for the factCheckClaim function.
 * - FactCheckClaimOutput - The return type for the factCheckClaim function.
 */
import { z } from 'zod';
import { groundedModel } from '../genkit.js';
const FactCheckClaimInputSchema = z.object({
    claim: z.string().describe('The claim to be fact-checked.'),
});
const FactCheckClaimOutputSchema = z.object({
    verdict: z.enum(['True', 'False', 'Misleading', 'Uncertain']).describe('The verdict of the fact-check.'),
    evidence: z.array(z.object({
        source: z.string().describe('The source type or recommended verification method.'),
        title: z.string().describe('The title or verification method description.'),
        snippet: z.string().describe('Key points to look for when verifying this claim.'),
    })).describe('A list of source recommendations and verification guidance.'),
    explanation: z.string().describe('A detailed explanation of the fact-check result.'),
});
// Function to clean and parse potentially malformed JSON or extract structured info from text
function cleanAndParseJson(responseText) {
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
        }
        catch (e) {
            console.log('JSON parsing failed, trying text extraction');
        }
    }
    // If JSON parsing fails, extract information from the text
    const text = responseText.toLowerCase();
    let verdict = 'Uncertain';
    // Determine verdict from text content
    if (text.includes('false') || text.includes('incorrect') || text.includes('not true')) {
        verdict = 'False';
    }
    else if (text.includes('true') || text.includes('correct') || text.includes('accurate')) {
        verdict = 'True';
    }
    else if (text.includes('misleading') || text.includes('partially') || text.includes('mixed')) {
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
export async function factCheckClaim(input) {
    const prompt = `You are a professional fact-checker. Analyze this claim thoroughly and provide a comprehensive verdict.

Claim: "${input.claim}"

Instructions:
1. Use your training knowledge to evaluate this claim comprehensively
2. Determine if the claim is True, False, Misleading, or Uncertain
3. Provide a detailed explanation with context and nuance
4. Suggest multiple reliable sources for verification

CRITICAL: Respond ONLY with valid JSON. No markdown, no extra text.

Required format:
{
  "verdict": "True|False|Misleading|Uncertain",
  "explanation": "Detailed explanation with context, explaining WHY the claim is true/false/misleading, what the actual facts are, and any important nuances or caveats. Include relevant background information.",
  "evidence": [
    {
      "source": "Type of authoritative source (e.g., Scientific journals, Government agencies, Academic institutions)",
      "title": "Specific verification approach or resource",
      "snippet": "Detailed guidance on what to look for, including specific facts, data points, or context that would help verify or refute this claim"
    }
  ]
}

Provide thorough, educational explanations that help users understand the full context. Include at least 3 evidence sources.`;
    let response;
    try {
        const result = await groundedModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
    }
    catch (error) {
        console.error('[ERROR] Fact-check analysis failed:', error);
        // Handle Zod validation errors specifically
        if (error?.constructor?.name === 'ZodError') {
            console.error('[ERROR] Zod validation failed:', error?.issues);
            console.error('Response that failed validation:', response?.candidates?.[0]?.content?.parts?.[0]?.text);
            // Try to use the cleanAndParseJson fallback for malformed responses
            try {
                const fallbackResult = cleanAndParseJson(response?.candidates?.[0]?.content?.parts?.[0]?.text || '');
                // Create a safe fallback with proper structure
                return {
                    verdict: fallbackResult?.verdict || 'Uncertain',
                    evidence: Array.isArray(fallbackResult?.evidence) ?
                        fallbackResult.evidence.map((item) => ({
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
            }
            catch (fallbackError) {
                console.error('[ERROR] Fallback parsing also failed:', fallbackError);
            }
        }
        // Final fallback for any other errors
        return {
            verdict: 'Uncertain',
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
//# sourceMappingURL=fact-check-claim.js.map