import { z } from 'zod';
import { performWebAnalysis } from './perform-web-analysis.js';
import { factCheckClaim } from './fact-check-claim.js';
import { groundedModel } from '../genkit.js';

const TextAnalysisInputSchema = z.object({
  text: z.string().min(1, 'Text content is required'),
});
export type TextAnalysisInput = z.infer<typeof TextAnalysisInputSchema>;

const TextAnalysisOutputSchema = z.object({
  // 1. Analysis Label (risk level)
  analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']).describe('Risk level of the content'),
  
  // 2. One-line description (AI polished)
  oneLineDescription: z.string().describe('Brief AI-polished description of the text'),
  
  // 3. Information summary (AI polished)
  summary: z.string().describe('Detailed AI-polished summary of the analysis'),
  
  // 4. Educational insight (AI polished)
  educationalInsight: z.string().describe('AI-polished educational content on manipulation techniques'),
  
  // 5. Sources, scores, and verdict
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    credibility: z.number().min(0).max(1),
  })).describe('Factual and legitimate web sources'),
  
  sourceIntegrityScore: z.number().min(0).max(100).describe('Source integrity score'),
  contentAuthenticityScore: z.number().min(0).max(100).describe('Content authenticity score'),
  trustExplainabilityScore: z.number().min(0).max(100).describe('Trust explainability score'),
  
  // Internal data for processing
  claims: z.array(z.object({
    claim: z.string(),
    verdict: z.enum(['VERIFIED', 'DISPUTED', 'UNVERIFIED']),
    confidence: z.number().min(0).max(1),
    explanation: z.string(),
    evidence: z.array(z.object({
        source: z.string(),
        title: z.string(),
        snippet: z.string(),
    })).optional(),
  })).optional(),
});
export type TextAnalysisOutput = z.infer<typeof TextAnalysisOutputSchema>;

// Safe JSON parser with fallback recovery for AI-generated responses
function tryParseJsonLoose(text: string): any {
  if (!text || text.trim().length === 0) return null;
  try {
    // Strip ALL markdown code fences
    const stripped = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();
    const start = stripped.indexOf('{');
    if (start === -1) return null;
    const end = stripped.lastIndexOf('}');
    // Use everything from first { to last } if both exist, or from { to end if truncated
    const candidate = (end !== -1 && end > start)
      ? stripped.substring(start, end + 1)
      : stripped.substring(start);

    // Try direct parse
    try { return JSON.parse(candidate); } catch {}
    // Fix trailing commas
    const cleaned = candidate.replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(cleaned); } catch {}

    // Try to fix truncated JSON by closing open strings and braces
    let fixable = cleaned;
    // Remove trailing incomplete key-value (e.g., `"summary": "The speaker re`)
    fixable = fixable.replace(/,\s*"[^"]*":\s*"[^"]*$/s, '');
    // Close unclosed string
    const quoteCount = (fixable.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) fixable += '"';
    // Close any open braces/brackets
    const openBraces = (fixable.match(/\{/g) || []).length;
    const closeBraces = (fixable.match(/\}/g) || []).length;
    const openBrackets = (fixable.match(/\[/g) || []).length;
    const closeBrackets = (fixable.match(/\]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) fixable += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) fixable += '}';
    try { return JSON.parse(fixable); } catch { return null; }
  } catch {
    return null;
  }
}

// Helper to break text into claims using simple heuristics (no LLM)
function extractClaims(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[\.\!\?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  
  // Enhanced factual claim detection
  const factualRegex = /(\bis\b|\bare\b|\bwas\b|\bwere\b|\bhas\b|\bhave\b|\bclaims?\b|\breports?\b|\baccording to\b|\bpercent|\b\d{4}\b|\bround\b|\bflat\b|\balive\b|\bdead\b|\btrue\b|\bfalse\b|\breal\b|\bfake\b)/i;
  
  // For very short texts, treat the entire text as a claim if it contains factual indicators
  if (text.length < 100 && factualRegex.test(text)) {
    return [text.trim()];
  }
  
  const claims = sentences.filter(s => s.length > 10 && factualRegex.test(s));
  
  // If no claims found but text is short and seems factual, use the whole text
  if (claims.length === 0 && text.length < 200 && text.trim().length > 5) {
    return [text.trim()];
  }
  
  // Limit to 5 for efficiency
  return claims.slice(0, 5);
}

// Helper to fact-check claims using the dedicated fact-check function
async function factCheckClaimWithSources(claim: string) {
  try {
    const result = await factCheckClaim({ claim });
    return {
      claim,
      verdict: result.verdict === 'True' ? 'VERIFIED' as const : 
               result.verdict === 'False' ? 'DISPUTED' as const : 'UNVERIFIED' as const,
      confidence: result.verdict === 'Uncertain' ? 0.3 : 0.7,
      explanation: result.explanation || 'Analysis completed',
      evidence: result.evidence,
    };
  } catch (error) {
    console.error('Error fact-checking claim:', error);
    return {
      claim,
      verdict: 'UNVERIFIED' as const,
      confidence: 0.3,
      explanation: 'Unable to verify claim',
      evidence: [],
    };
  }
}

// Helper to determine overall verdict and analysis label
const determineOverallVerdict = (claims: any[]) => {
  const verifiedCount = claims.filter(c => c.verdict === 'VERIFIED').length;
  const disputedCount = claims.filter(c => c.verdict === 'DISPUTED').length;
  const unverifiedCount = claims.filter(c => c.verdict === 'UNVERIFIED').length;
  const total = claims.length;

  if (verifiedCount === total) return { verdict: 'VERIFIED', label: 'GREEN' };
  if (disputedCount + unverifiedCount === total) return { verdict: 'DISPUTED', label: 'RED' };
  if (verifiedCount > disputedCount + unverifiedCount) return { verdict: 'VERIFIED', label: 'YELLOW' };
  return { verdict: 'MIXED', label: 'ORANGE' };
};

// Helper to calculate scores with improved logic
function calculateScores(claims: any[], webSourcesCount: number): {
  sourceIntegrityScore: number;
  contentAuthenticityScore: number;
  trustExplainabilityScore: number;
} {
  const totalClaims = Math.max(1, claims.length);
  const verifiedClaims = claims.filter(c => c.verdict === 'VERIFIED').length;
  const disputedClaims = claims.filter(c => c.verdict === 'DISPUTED').length;
  const unverifiedClaims = claims.filter(c => c.verdict === 'UNVERIFIED').length;
  
  // Calculate average confidence, handling edge cases
  const avgConfidence = claims.length > 0 
    ? claims.reduce((sum, c) => sum + (c.confidence || 0.5), 0) / totalClaims 
    : 0.5;
  
  // Source Integrity Score (0-100)
  // Based on: verification rate (50%), web sources availability (30%), source quality (15%), confidence (5%)
  const verificationRate = verifiedClaims / totalClaims;
  const sourceAvailability = Math.min(1, webSourcesCount / 3); // Optimal: 3+ quality sources
  const sourceQuality = webSourcesCount > 0 ? 0.9 : 0.5; // High quality for fact-check sources
  const sourceIntegrityScore = Math.round(
    verificationRate * 50 + 
    sourceAvailability * 30 + 
    sourceQuality * 15 +
    avgConfidence * 5
  );

  // Content Authenticity Score (0-100)
  // Nuanced scoring with baseline
  let contentAuthenticityScore = 85; // Start with high baseline
  if (totalClaims > 0) {
    const verifiedBonus = (verifiedClaims / totalClaims) * 15; // Bonus for verified claims
    const disputePenalty = (disputedClaims / totalClaims) * 70; // Heavy penalty for false info
    const unverifiedPenalty = (unverifiedClaims / totalClaims) * 25; // Moderate penalty for uncertainty
    
    contentAuthenticityScore = Math.round(
      contentAuthenticityScore + verifiedBonus - disputePenalty - unverifiedPenalty
    );
  }

  // Trust Explainability Score (0-100)
  // Balanced with confidence boost
  const confidenceBoost = avgConfidence > 0.8 ? 10 : 0;
  const trustExplainabilityScore = Math.round(
    contentAuthenticityScore * 0.4 + 
    sourceIntegrityScore * 0.4 + 
    avgConfidence * 100 * 0.2 +
    confidenceBoost
  );

  // Ensure all scores are within valid range
  return {
    sourceIntegrityScore: Math.min(100, Math.max(0, sourceIntegrityScore)),
    contentAuthenticityScore: Math.min(100, Math.max(0, contentAuthenticityScore)),
    trustExplainabilityScore: Math.min(100, Math.max(0, trustExplainabilityScore)),
  };
}

// Consolidation: Integrated Presentation Formatter
async function formatPresentation(params: {
  text: string;
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  claims: any[];
  webSources: any[];
}): Promise<{
  oneLineDescription: string;
  summary: string;
  educationalInsight: string;
  sources: Array<{ url: string; title: string; credibility: number }>;
}> {
  const { text, analysisLabel, claims, webSources } = params;
  
  const prompt = `You are a professional misinformation analyst. Generate factual, informative content based on the analysis results.

TASK: Convert the analysis signals into a clean, factual presentation.

CONTENT ANALYZED: "${text.substring(0, 500)}"
RISK LEVEL: ${analysisLabel}
CLAIMS FOUND: ${JSON.stringify(claims.map(c => ({ claim: c.claim, verdict: c.verdict })))}
WEB SOURCES: ${JSON.stringify(webSources.slice(0, 3).map(s => s.title))}

REQUIREMENTS:
1. Generate FACTUAL, INFORMATIVE content - not generic placeholders.
2. oneLineDescription: Concise 1-2 line description explaining what the content is about and its key finding.
3. summary: Detailed 3-4 sentence analysis explaining specific findings and evidence.
4. educationalInsight: 150-200 words of readable, easy to understand guidance on manipulation techniques and protection strategies.
5. sources: Select the 3-5 most relevant and credible sources from the web analysis or authoritative fact-checkers.

OUTPUT FORMAT - ONLY VALID JSON:
{
  "oneLineDescription": "concise description",
  "summary": "detailed factual analysis",
  "educationalInsight": "actionable guidance",
  "sources": [
    { "url": "string", "title": "string", "credibility": number }
  ]
}`;

  try {
    const result = await groundedModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000, responseMimeType: 'application/json' }
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[formatPresentation] Response length:', responseText.length, 'first 100:', responseText.substring(0, 100));

    // Safe JSON extraction with fallback recovery
    const parsed = tryParseJsonLoose(responseText);
    if (parsed) {
      return {
        oneLineDescription: parsed.oneLineDescription || 'Analysis completed.',
        summary: parsed.summary || 'Detailed summary unavailable.',
        educationalInsight: parsed.educationalInsight || 'Exercise caution and verify claims.',
        sources: Array.isArray(parsed.sources)
          ? parsed.sources.slice(0, 5).map((s: any) => ({
              url: s.url || '',
              title: s.title || '',
              credibility: Math.min(1, Math.max(0, typeof s.credibility === 'number' ? (s.credibility > 1 ? s.credibility / 100 : s.credibility) : 0.5)),
            }))
          : []
      };
    }
    console.warn('[WARN] formatPresentation: tryParseJsonLoose returned null for response');
  } catch (error) {
    console.error('[ERROR] Presentation formatting failed:', error);
  }

  // Data-driven fallback: use the actual claim results instead of generic text
  console.warn('[WARN] formatPresentation Gemini call failed or returned empty — using claim-data fallback');

  // Build one-line description from claim verdicts
  const verdictCounts = {
    VERIFIED: claims.filter(c => c.verdict === 'VERIFIED').length,
    DISPUTED: claims.filter(c => c.verdict === 'DISPUTED').length,
    UNVERIFIED: claims.filter(c => c.verdict === 'UNVERIFIED').length,
  };

  let oneLineDescription: string;
  if (verdictCounts.DISPUTED > 0) {
    oneLineDescription = `This claim has been assessed as likely false based on fact-check analysis.`;
  } else if (verdictCounts.VERIFIED === claims.length && claims.length > 0) {
    oneLineDescription = `The claims in this content appear to be verified and factually accurate.`;
  } else {
    oneLineDescription = `This content contains claims that could not be fully verified. Exercise caution.`;
  }

  // Build summary from actual claim explanations
  const claimSummaries = claims
    .map(c => `"${c.claim.substring(0, 80)}" — ${c.verdict}${c.explanation ? ': ' + c.explanation.substring(0, 150) : ''}`)
    .join(' ');
  const summary = claimSummaries || `Content analyzed with ${claims.length} claims identified. Risk level: ${analysisLabel}.`;

  // Build educational insight based on what was found
  const educationalInsight = verdictCounts.DISPUTED > 0
    ? 'This content contains claims that fact-checkers have assessed as false or misleading. Always verify sensational claims through multiple trusted sources like Snopes, FactCheck.org, or Reuters Fact Check before sharing. Misinformation often exploits emotional reactions — pause and verify before believing or sharing.'
    : 'When evaluating any information, cross-reference claims with established fact-checking organizations and authoritative sources. Look for primary sources, check the date and context, and be wary of sensational headlines designed to provoke emotional reactions.';

  // Use web sources if available, otherwise use defaults
  const sources = webSources.length > 0
    ? webSources.slice(0, 5).map((s: any) => ({
        url: s.url || '',
        title: s.title || 'Source',
        credibility: Math.min(1, Math.max(0, typeof s.credibility === 'number' ? (s.credibility > 1 ? s.credibility / 100 : s.credibility) : 0.7)),
      }))
    : [
        { url: 'https://www.snopes.com', title: 'Snopes Fact Checking', credibility: 0.95 },
        { url: 'https://www.factcheck.org', title: 'FactCheck.org', credibility: 0.93 },
        { url: 'https://www.politifact.com', title: 'PolitiFact', credibility: 0.91 }
      ];

  return { oneLineDescription, summary, educationalInsight, sources };
}

// Main analysis function
export async function analyzeTextContent(input: TextAnalysisInput, options?: { searchEngineId?: string }): Promise<TextAnalysisOutput> {
  try {
    // Start web analysis early in parallel
    const webAnalysisPromise = (async () => {
      try {
        const webAnalysis = await performWebAnalysis({
          query: input.text.substring(0, 500),
          contentType: 'text',
          searchEngineId: options?.searchEngineId,
        });
        return webAnalysis.currentInformation || [];
      } catch (error) {
        console.error('[ERROR] Web analysis failed:', error);
        return [] as any[];
      }
    })();

    // Step 1: Break down text into claims
    const claims = await extractClaims(input.text);
    const claimsToAnalyze = claims.slice(0, 5); 

    // Step 2: Fact-check each claim
    const analyzedClaims = await Promise.all(claimsToAnalyze.map(claim => factCheckClaimWithSources(claim)));

    // Step 3: Retrieve web sources result
    const webSources: any[] = await webAnalysisPromise;

    // Step 4: Determine analysis label
    const { verdict, label } = determineOverallVerdict(analyzedClaims);
    
    // Step 5: Calculate scores
    const scores = calculateScores(analyzedClaims, webSources.length);

    // Step 6: Consolidated formatting
    const presentation = await formatPresentation({
      text: input.text,
      analysisLabel: label as 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN',
      claims: analyzedClaims,
      webSources
    });

    return {
      analysisLabel: label as 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN',
      oneLineDescription: presentation.oneLineDescription,
      summary: presentation.summary,
      educationalInsight: presentation.educationalInsight,
      sources: presentation.sources,
      sourceIntegrityScore: scores.sourceIntegrityScore,
      contentAuthenticityScore: scores.contentAuthenticityScore,
      trustExplainabilityScore: scores.trustExplainabilityScore,
      claims: analyzedClaims,
    };
  } catch (error) {
    console.error('[ERROR] Text analysis failed:', error);
    
    // Return error response with proper format
    return {
      analysisLabel: 'RED',
      oneLineDescription: 'Text analysis encountered an error',
      summary: 'The text analysis could not be completed due to technical issues. Please try again.',
      educationalInsight: 'When text analysis fails, verify information manually using trusted fact-checking websites.',
      sources: [
        { url: 'https://www.snopes.com', title: 'Snopes Fact Checking', credibility: 0.95 }
      ],
      sourceIntegrityScore: 0,
      contentAuthenticityScore: 0,
      trustExplainabilityScore: 0,
      claims: [],
    };
  }
}
