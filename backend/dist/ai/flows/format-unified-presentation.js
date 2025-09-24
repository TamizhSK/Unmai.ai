'use server';
import { z } from 'zod';
import { groundedModel } from '../genkit.js';
const PresentationSchema = z.object({
    oneLineDescription: z.string().min(1),
    summary: z.string().min(1),
    educationalInsight: z.string().min(1),
    sources: z.array(z.object({
        url: z.string().url(),
        title: z.string().min(1),
        credibility: z.number().min(0).max(1)
    })).min(3).max(8)
});
function cleanJson(text) {
    const parsed = safeJsonParse(text);
    if (!parsed) {
        throw new Error('Unable to parse AI presentation JSON');
    }
    return parsed;
}
function safeJsonParse(raw) {
    if (!raw)
        return null;
    let txt = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    const start = txt.indexOf('{');
    const end = txt.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        txt = txt.substring(start, end + 1);
    }
    if (attemptParse(txt))
        return attemptParse(txt);
    txt = normalizeJsonArtifacts(txt);
    return attemptParse(txt);
}
function normalizeJsonArtifacts(input) {
    return input
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/"([^"\\]*?)\\"(\s*:)/g, '"$1"$2')
        .replace(/"([^"\\]+)""(\s*:)/g, '"$1"$2')
        .replace(/:\s*""([^"\\]*?)"/g, ': "$1"')
        .replace(/:""([^"\\]*?)"/g, ':"$1"')
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/"{3,}/g, '"')
        .replace(/"{2}/g, '"')
        .trim();
}
function attemptParse(value) {
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
export async function formatUnifiedPresentation(input) {
    const prompt = `You are a professional misinformation analyst. Generate factual, informative content based on the analysis results.

Task: Convert the analysis signals below into a clean, factual presentation for users.

CONTENT GENERATION RULES:
1. Generate FACTUAL, INFORMATIVE content - not generic placeholders
2. Use the rawSignals data to create specific, detailed descriptions
3. Reference actual findings from the analysis
4. Be specific about what was analyzed and what was found
5. Provide educational value based on the actual content

CRITICAL JSON FORMATTING:
- ONLY valid JSON - no markdown, backticks, or extra text
- Use double quotes for all strings
- Escape quotes with backslash
- No line breaks in strings - use spaces
- No control characters

Required JSON format:
{
  "oneLineDescription": "Specific description of what was analyzed and the key finding",
  "summary": "Detailed factual summary of the analysis results with specific findings",
  "educationalInsight": "Practical guidance based on the actual analysis results",
  "sources": [
    {"url": "valid_url", "title": "descriptive_title", "credibility": 0.9}
  ]
}

IMPORTANT: Generate content that reflects the actual analysis - not generic templates!

Required JSON schema:
{
  "oneLineDescription": string,
  "summary": string,
  "educationalInsight": string,
  "sources": [
    { "url": string, "title": string, "credibility": number }
  ]
}

Context:
contentType: ${input.contentType}
analysisLabel: ${input.analysisLabel}
rawSignals: ${JSON.stringify(input.rawSignals).slice(0, 4000)}

candidateSources (prioritized list):
${JSON.stringify(input.candidateSources).slice(0, 4000)}
`;
    const result = await groundedModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 }
    });
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    try {
        const parsed = cleanJson(text);
        const validated = PresentationSchema.parse(parsed);
        console.log('[INFO] Successfully parsed AI-generated presentation');
        return validated;
    }
    catch (e) {
        console.error('[ERROR] Failed to parse AI response for presentation formatting:', e);
        console.error('[ERROR] Raw AI response:', text.substring(0, 1000));
        // Enhanced fallback with actual content from rawSignals
        const claims = input.rawSignals?.claims || [];
        const verifiedCount = claims.filter((c) => c.verdict === 'VERIFIED').length;
        const disputedCount = claims.filter((c) => c.verdict === 'DISPUTED').length;
        const totalClaims = claims.length;
        let summaryText = `Analysis of ${input.contentType} content with ${totalClaims} claim${totalClaims !== 1 ? 's' : ''} examined.`;
        if (totalClaims > 0) {
            summaryText += ` ${verifiedCount} verified, ${disputedCount} disputed.`;
            if (disputedCount > 0) {
                summaryText += ' Contains potentially false or misleading information.';
            }
        }
        let educationalText = 'Key protection strategies: Verify claims through multiple independent sources, check publication dates, examine author credentials, and cross-reference with established fact-checking organizations.';
        if (input.analysisLabel === 'RED') {
            educationalText += ' This content shows high-risk indicators - exercise extreme caution before sharing.';
        }
        const fallbackSources = (input.candidateSources || [])
            .filter(s => s.url && s.url.startsWith('http'))
            .slice(0, 6)
            .map((s) => ({
            url: s.url,
            title: s.title || 'Verification Resource',
            credibility: s.relevance ? Math.min(1, Math.max(0.5, s.relevance / 100)) : 0.8
        }));
        const defaultSources = [
            { url: 'https://www.snopes.com', title: 'Snopes - Fact Checking', credibility: 0.95 },
            { url: 'https://www.factcheck.org', title: 'FactCheck.org - Nonpartisan Analysis', credibility: 0.93 },
            { url: 'https://www.politifact.com', title: 'PolitiFact - Truth-O-Meter', credibility: 0.91 },
            { url: 'https://fullfact.org', title: 'Full Fact - UK Fact Checking', credibility: 0.89 }
        ];
        return PresentationSchema.parse({
            oneLineDescription: `${input.contentType.charAt(0).toUpperCase() + input.contentType.slice(1)} analysis completed - ${input.analysisLabel} risk level detected`,
            summary: summaryText,
            educationalInsight: educationalText,
            sources: fallbackSources.length >= 3 ? fallbackSources : defaultSources.slice(0, 5)
        });
    }
}
//# sourceMappingURL=format-unified-presentation.js.map