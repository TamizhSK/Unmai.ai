import { z } from 'zod';
import { performWebAnalysis } from './perform-web-analysis.js';
import { formatUnifiedPresentation } from './format-unified-presentation.js';
import { factCheckClaim } from './fact-check-claim.js';

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
  // Based on: verification rate (60%), web sources availability (25%), confidence (15%)
  const verificationRate = verifiedClaims / totalClaims;
  const sourceAvailability = Math.min(1, webSourcesCount / 5); // Optimal: 5+ sources
  const sourceIntegrityScore = Math.round(
    verificationRate * 60 + 
    sourceAvailability * 25 + 
    avgConfidence * 15
  );

  // Content Authenticity Score (0-100)
  // Heavily penalize disputed claims, moderately penalize unverified
  const authenticityBase = verifiedClaims / totalClaims * 100;
  const disputePenalty = (disputedClaims / totalClaims) * 60; // Heavy penalty for false info
  const unverifiedPenalty = (unverifiedClaims / totalClaims) * 20; // Moderate penalty for uncertainty
  const contentAuthenticityScore = Math.round(authenticityBase - disputePenalty - unverifiedPenalty);

  // Trust Explainability Score (0-100)
  // Weighted average with emphasis on content authenticity
  const trustExplainabilityScore = Math.round(
    contentAuthenticityScore * 0.5 + 
    sourceIntegrityScore * 0.3 + 
    avgConfidence * 100 * 0.2
  );

  // Ensure all scores are within valid range and log calculation details
  const finalScores = {
    sourceIntegrityScore: Math.min(100, Math.max(0, sourceIntegrityScore)),
    contentAuthenticityScore: Math.min(100, Math.max(0, contentAuthenticityScore)),
    trustExplainabilityScore: Math.min(100, Math.max(0, trustExplainabilityScore)),
  };

  console.log(`[INFO] Trust scores calculated: verified=${verifiedClaims}/${totalClaims}, disputed=${disputedClaims}, sources=${webSourcesCount}, confidence=${avgConfidence.toFixed(2)}`);
  console.log(`[INFO] Final scores: source=${finalScores.sourceIntegrityScore}, authenticity=${finalScores.contentAuthenticityScore}, explainability=${finalScores.trustExplainabilityScore}`);

  return finalScores;
}

// Main analysis function
export async function analyzeTextContent(input: TextAnalysisInput, options?: { searchEngineId?: string }): Promise<TextAnalysisOutput> {
  try {
    // Start web analysis early in parallel (independent of claim extraction)
    const webAnalysisPromise = (async () => {
      try {
        const webAnalysis = await performWebAnalysis({
          query: input.text.substring(0, 500),
          contentType: 'text',
          searchEngineId: options?.searchEngineId,
        });
        return webAnalysis.currentInformation || [];
      } catch (error) {
        console.error('Web analysis failed:', error);
        return [] as any[];
      }
    })();

    // Step 1: Break down text into claims
    const claims = await extractClaims(input.text);
    const claimsToAnalyze = claims.slice(0, 5); // Limit to 5 claims for efficiency

    // Step 2: Fact-check each claim (already parallelized across claims)
    const analyzedClaims = await Promise.all(claimsToAnalyze.map(claim => factCheckClaimWithSources(claim)));

    // Step 3: Retrieve web sources result
    const webSources: any[] = await webAnalysisPromise;

    // Step 4: Determine analysis label
    const { verdict, label } = determineOverallVerdict(analyzedClaims);
    
    // Step 5: Calculate scores
    const scores = calculateScores(analyzedClaims, webSources.length);

    // Step 6: Gemini-driven formatting of presentation fields and sources
    const candidateSources = (webSources || []).map((s: any) => ({ url: s.url, title: s.title, snippet: s.snippet, relevance: s.relevance }));
    const presentation = await formatUnifiedPresentation({
      contentType: 'text',
      analysisLabel: label as 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN',
      rawSignals: {
        claims: analyzedClaims,
        totalClaims: claims.length,
        webSources
      },
      candidateSources
    });

    return {
      analysisLabel: label as 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN',
      oneLineDescription: presentation.oneLineDescription,
      summary: presentation.summary,
      educationalInsight: presentation.educationalInsight,
      sources: presentation.sources.slice(0, 8),
      sourceIntegrityScore: scores.sourceIntegrityScore,
      contentAuthenticityScore: scores.contentAuthenticityScore,
      trustExplainabilityScore: scores.trustExplainabilityScore,
      claims: analyzedClaims,
    };
  } catch (error) {
    console.error('Error in text analysis:', error);
    
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
