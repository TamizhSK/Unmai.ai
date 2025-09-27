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
/**
 * Cleans and parses potentially malformed JSON from AI responses
 * @param responseText - Raw response text from AI model
 * @returns Parsed JSON object or null if parsing fails
 */
function cleanAndParseJson(responseText) {
    if (!responseText || typeof responseText !== 'string') {
        console.warn('[WARN] Invalid response text provided to cleanAndParseJson');
        return null;
    }
    console.log('[DEBUG] Raw response first 200 chars:', responseText.substring(0, 200));
    // Step 1: Remove markdown code blocks and trim
    let cleanJson = responseText
        .replace(/^```json\s*/gim, '')
        .replace(/^```\s*/gim, '')
        .replace(/```\s*$/gim, '')
        .trim();
    // Step 2: Find JSON object boundaries first
    const jsonStart = cleanJson.indexOf('{');
    const jsonEnd = cleanJson.lastIndexOf('}');
    // Early validation of JSON boundaries
    if (jsonStart === -1) {
        console.warn('[WARN] No opening brace found in response');
        return null;
    }
    if (jsonEnd === -1 || jsonEnd <= jsonStart) {
        console.warn('[WARN] Invalid or missing closing brace, attempting reconstruction');
        // Try to find a reasonable end point
        let braceCount = 1;
        let inString = false;
        let lastValidIndex = 0;
        for (let i = 1; i < cleanJson.length - jsonStart; i++) {
            const char = cleanJson[jsonStart + i];
            const prevChar = cleanJson[jsonStart + i - 1];
            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
            }
            if (!inString) {
                if (char === '{')
                    braceCount++;
                if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        cleanJson = cleanJson.substring(jsonStart, jsonStart + i + 1);
                        break;
                    }
                }
                // Track last valid position (after comma or closing quote)
                if (char === ',' || (char === '"' && cleanJson[jsonStart + i + 1]?.match(/\s*[,}]/))) {
                    lastValidIndex = i;
                }
            }
        }
        // If we couldn't find proper closing, use last valid position
        if (braceCount > 0 && lastValidIndex > 0) {
            cleanJson = cleanJson.substring(jsonStart, jsonStart + lastValidIndex + 1) + '}';
        }
        else if (braceCount > 0) {
            cleanJson = cleanJson.substring(jsonStart) + '}';
        }
    }
    else {
        cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
    }
    console.log('[DEBUG] Extracted JSON boundaries, length:', cleanJson.length);
    // Step 3: Apply comprehensive JSON cleaning
    cleanJson = cleanJson
        // Phase 1: Normalize quotes and basic structure
        .replace(/[\u201C\u201D]/g, '"') // Smart quotes to straight
        .replace(/[\u2018\u2019]/g, "'") // Smart apostrophes
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        // Phase 2: Fix malformed key-value separators
        .replace(/"([^"\\]*?)\\"(\s*:)/g, '"$1"$2') // "key\": -> "key":
        .replace(/"([^"\\]+)""(\s*:)/g, '"$1"$2') // "key"": -> "key":
        .replace(/\\"(?=\s*:)/g, '"') // \" before colon -> "
        // Phase 3: Fix malformed values
        .replace(/:""([^"]*?)"/g, ':"$1"') // :""value" -> :"value"
        .replace(/:\s*""([^"]*?)"/g, ': "$1"') // : ""value" -> : "value"
        .replace(/:\s*\\"/g, ': "') // : \" -> : "
        // Phase 4: Quote unquoted keys and fix single quotes
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Unquoted keys
        .replace(/:\s*'([^'\\]*(\\.[^'\\]*)*)'/g, ': "$1"') // Single to double quotes
        // Phase 5: Handle newlines and special characters in strings
        .replace(/"([^"]*?)\n([^"]*?)"/g, '"$1\\n$2"') // Escape newlines in strings
        .replace(/"([^"]*?)\r([^"]*?)"/g, '"$1\\r$2"') // Escape carriage returns
        .replace(/"([^"]*?)\t([^"]*?)"/g, '"$1\\t$2"') // Escape tabs
        // Phase 6: Fix trailing commas and incomplete structures
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/"\s*$/, '"}') // Fix incomplete string at end
        .replace(/"([^"\\]*(\\.[^"\\]*)*)"\s*([,}])/g, '"$1"$3'); // Ensure proper string termination
    // Step 4: Attempt JSON parsing with progressive fallbacks
    console.log('[DEBUG] Attempting JSON parse, cleaned length:', cleanJson.length);
    // First attempt: Standard parsing
    try {
        const parsed = JSON.parse(cleanJson);
        console.log('[SUCCESS] JSON parsed successfully');
        return parsed;
    }
    catch (firstError) {
        console.log('[WARN] First parse attempt failed:', firstError.message);
        // Extract error position for debugging
        const posMatch = firstError.message.match(/position (\d+)/i);
        if (posMatch) {
            const pos = parseInt(posMatch[1]);
            console.log(`[DEBUG] Error at position ${pos}:`, {
                char: cleanJson[pos],
                charCode: cleanJson.charCodeAt(pos),
                context: cleanJson.substring(Math.max(0, pos - 15), pos + 15)
            });
        }
        // Second attempt: Aggressive quote normalization
        try {
            let aggressiveClean = cleanJson
                .replace(/"""+/g, '"') // Remove multiple consecutive quotes
                .replace(/""(\s*[:}])/g, '"$1') // Fix doubled quotes before colons/braces
                .replace(/([:,]\s*)""/g, '$1"') // Fix doubled quotes after colons/commas
                .replace(/([^\\])""([^:])/g, '$1"$2') // Fix doubled quotes in middle of strings
                .replace(/\\{2,}/g, '\\') // Normalize multiple backslashes
                .replace(/([^"]),([^\s"])/g, '$1, $2'); // Add spaces after commas
            console.log('[INFO] Attempting aggressive cleaning...');
            const parsed = JSON.parse(aggressiveClean);
            console.log('[SUCCESS] Aggressive cleaning succeeded');
            return parsed;
        }
        catch (secondError) {
            console.log('[ERROR] Aggressive cleaning failed:', secondError.message);
            // Third attempt: Try to extract key-value pairs manually
            try {
                console.log('[INFO] Attempting manual key-value extraction...');
                const manualParsed = extractKeyValuePairs(cleanJson);
                if (manualParsed && Object.keys(manualParsed).length > 0) {
                    console.log('[SUCCESS] Manual extraction succeeded');
                    return manualParsed;
                }
            }
            catch (thirdError) {
                console.log('[ERROR] Manual extraction failed:', thirdError.message);
            }
        }
    }
    // Final fallback: Extract information from raw text
    console.log('[INFO] All JSON parsing attempts failed, falling back to text extraction');
    return extractFromText(responseText);
}
/**
 * Manually extracts key-value pairs from malformed JSON using regex patterns
 * @param jsonStr - Malformed JSON string
 * @returns Extracted object or null if no valid data found
 */
function extractKeyValuePairs(jsonStr) {
    const result = {};
    // Extract verdict
    const verdictMatch = jsonStr.match(/["']?verdict["']?\s*:\s*["']?(True|False|Misleading|Uncertain)["']?/i);
    if (verdictMatch) {
        result.verdict = verdictMatch[1];
    }
    // Extract explanation
    const explanationMatch = jsonStr.match(/["']?explanation["']?\s*:\s*["']([^"']*(?:\\.[^"']*)*)["']?/i);
    if (explanationMatch) {
        result.explanation = explanationMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
    }
    // Extract evidence array (simplified - returns empty array for now)
    result.evidence = [];
    return Object.keys(result).length > 0 ? result : null;
}
/**
 * Extracts information from raw text when JSON parsing completely fails
 * @param responseText - Raw response text
 * @returns Structured object with extracted information
 */
function extractFromText(responseText) {
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
    let explanation = responseText
        .replace(/\[\d+(?:,\s*\d+)*\]/g, '') // Remove reference numbers
        .replace(/```[^`]*```/g, '') // Remove code blocks
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markdown
        .trim();
    // Split into sentences and take substantial ones
    const sentences = explanation.split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 20 && !s.match(/^(json|```|{|})/i));
    explanation = sentences.slice(0, 3).join('. ').trim();
    // Ensure proper ending
    if (explanation && !explanation.match(/[.!?]$/)) {
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
            console.error('[ERROR] Zod validation failed:', error?.message);
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