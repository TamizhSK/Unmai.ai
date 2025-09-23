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
  const factualRegex = /(\bis\b|\bare\b|\bwas\b|\bwere\b|\bhas\b|\bhave\b|\bclaims?\b|\breports?\b|\baccording to\b|\bpercent|\b\d{4}\b)/i;
  const claims = sentences.filter(s => s.length > 20 && factualRegex.test(s));
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
    };
  } catch (error) {
    console.error('Error fact-checking claim:', error);
    return {
      claim,
      verdict: 'UNVERIFIED' as const,
      confidence: 0.3,
      explanation: 'Unable to verify claim',
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

// Helper to calculate scores
function calculateScores(claims: any[]): {
  sourceIntegrityScore: number;
  contentAuthenticityScore: number;
  trustExplainabilityScore: number;
} {
  const verifiedClaims = claims.filter(c => c.verdict === 'VERIFIED').length;
  const totalClaims = claims.length || 1;
  const avgConfidence = claims.reduce((sum, c) => sum + c.confidence, 0) / totalClaims;
  const avgSourceCredibility = claims.reduce((sum, c) => 
    sum + (c.sources?.reduce((s: number, src: any) => s + src.credibility, 0) / (c.sources?.length || 1) || 0), 0) / totalClaims;
  
  return {
    sourceIntegrityScore: Math.round(avgSourceCredibility * 100),
    contentAuthenticityScore: Math.round((verifiedClaims / totalClaims) * 100),
    trustExplainabilityScore: Math.round(avgConfidence * 100),
  };
}

// Main analysis function
export async function analyzeTextContent(input: TextAnalysisInput): Promise<TextAnalysisOutput> {
  try {
    // Start web analysis early in parallel (independent of claim extraction)
    const webAnalysisPromise = (async () => {
      try {
        const webAnalysis = await performWebAnalysis({
          query: input.text.substring(0, 500),
          contentType: 'text'
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
    const scores = calculateScores(analyzedClaims);

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
