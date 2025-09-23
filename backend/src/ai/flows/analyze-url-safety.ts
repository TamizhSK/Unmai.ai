import { z } from 'zod';
import { WebRiskServiceClient } from '@google-cloud/web-risk';
import { performWebAnalysis } from './perform-web-analysis.js';
import { verifySource } from './verify-source.js';
import { formatUnifiedPresentation } from './format-unified-presentation.js';

const UrlAnalysisInputSchema = z.object({
  url: z.string().url('Valid URL is required'),
});
export type UrlAnalysisInput = z.infer<typeof UrlAnalysisInputSchema>;

const UrlAnalysisOutputSchema = z.object({
  // 1. Analysis Label (risk level)
  analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']).describe('Risk level of the URL'),
  
  // 2. One-line description (AI polished)
  oneLineDescription: z.string().describe('Brief AI-polished description of the URL'),
  
  // 3. Information summary (AI polished)
  summary: z.string().describe('Detailed AI-polished summary of the analysis'),
  
  // 4. Educational insight (AI polished)
  educationalInsight: z.string().describe('AI-polished educational content on URL safety'),
  
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
  metadata: z.object({
    domain: z.string().optional(),
    threats: z.array(z.string()).optional(),
    isSafe: z.boolean().optional(),
    reputationScore: z.number().optional(),
    ageDays: z.number().optional(),
  }).optional(),
});
export type UrlAnalysisOutput = z.infer<typeof UrlAnalysisOutputSchema>;

// Helper to check URL safety using Google Web Risk API
async function checkUrlSafety(url: string) {
  const client = new WebRiskServiceClient();
  // Use string threat types to avoid importing protos namespace
  const request = {
    uri: url,
    threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'] as unknown as string[],
  };

  try {
    const [response] = await client.searchUris(request as any);

    if (response.threat && response.threat.threatTypes) {
      return {
        isSafe: false,
        threats: response.threat.threatTypes.map((t: any) => String(t)),
        confidence: 0.95,
      };
    }
    return {
      isSafe: true,
      threats: [],
      confidence: 0.9,
    };
  } catch (error) {
    console.error('Web Risk API error:', error);
    return {
      isSafe: false,
      threats: ['API_ERROR'],
      confidence: 0.5,
    };
  }
}

// Helper to analyze domain using URL parsing and verification details
function analyzeDomain(url: string, verification?: any) {
  const domain = new URL(url).hostname;
  const reputationScore = Number(verification?.details?.reputationScore ?? verification?.sourceCredibility ?? 0.6);
  const ageDays = Number(verification?.details?.ageDays ?? 0);
  const registrar = String(verification?.details?.registrar || 'Unknown');
  return { domain, reputationScore, ageDays, registrar };
}

// Helper to get operator info from verification details
function getOperatorInfo(url: string, verification?: any) {
  return {
    name: verification?.details?.operator || verification?.author || 'Unknown',
    contact: verification?.details?.contact || 'Not available'
  };
}

// Helper to calculate scores with proper bounds checking
function calculateScores(securityStatus: any, domainInfo: any): {
  sourceIntegrityScore: number;
  contentAuthenticityScore: number;
  trustExplainabilityScore: number;
} {
  const safetyScore = securityStatus.isSafe ? 100 : 20;
  const reputationScore = (domainInfo.reputationScore || 0.5) * 100;
  const confidenceScore = securityStatus.confidence * 100;
  
  // Ensure all scores are within valid range (0-100)
  const finalScores = {
    sourceIntegrityScore: Math.min(100, Math.max(0, Math.round(reputationScore))),
    contentAuthenticityScore: Math.min(100, Math.max(0, Math.round(safetyScore))),
    trustExplainabilityScore: Math.min(100, Math.max(0, Math.round(confidenceScore))),
  };

  console.log(`[INFO] URL trust scores: safety=${securityStatus.isSafe}, reputation=${domainInfo.reputationScore || 0.5}, confidence=${securityStatus.confidence}`);
  console.log(`[INFO] Final URL scores: source=${finalScores.sourceIntegrityScore}, authenticity=${finalScores.contentAuthenticityScore}, explainability=${finalScores.trustExplainabilityScore}`);

  return finalScores;
}

// Main analysis function
export async function analyzeUrlSafety(input: UrlAnalysisInput, options?: { searchEngineId?: string }): Promise<UrlAnalysisOutput> {
  try {
    // Run independent steps concurrently for speed
    const [
      securityStatus,
      sourceVerification,
      webSources
    ] = await Promise.all([
      // Web Risk
      checkUrlSafety(input.url),
      // Source verification (backend)
      (async () => {
        try {
          return await verifySource({ content: input.url, contentType: 'url' });
        } catch (e) {
          console.warn('verifySource failed:', e);
          return undefined;
        }
      })(),
      // Web analysis (search)
      (async () => {
        try {
          const webAnalysis = await performWebAnalysis({ query: input.url, contentType: 'url', searchEngineId: options?.searchEngineId });
          return webAnalysis.currentInformation || [];
        } catch (error) {
          console.error('Web analysis failed:', error);
          return [] as any[];
        }
      })()
    ] as const);

    // Derive domain and operator info from URL and verification details
    const domainInfo = analyzeDomain(input.url, sourceVerification);
    const operatorInfo = getOperatorInfo(input.url, sourceVerification);

    // Step 5: Determine analysis label
    let analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN' = 'YELLOW';
    if (securityStatus.isSafe && (domainInfo.reputationScore || 0) > 0.8) {
      analysisLabel = 'GREEN';
    } else if (!securityStatus.isSafe && securityStatus.threats.length > 0) {
      analysisLabel = 'RED';
    } else if ((domainInfo.reputationScore || 0) < 0.5 || securityStatus.threats.length > 0) {
      analysisLabel = 'ORANGE';
    }

    // Step 6: Calculate scores
    const scores = calculateScores(securityStatus, domainInfo);

    // Step 7: Gemini-driven formatting of presentation fields and sources
    const candidateSources = [
      ...(webSources || []).map((s: any) => ({ url: s.url, title: s.title, snippet: s.snippet, relevance: s.relevance })),
      ...(sourceVerification?.relatedSources || []).map((s: any) => ({ url: s.url, title: s.title, relevance: s.similarity }))
    ];
    const presentation = await formatUnifiedPresentation({
      contentType: 'url',
      analysisLabel,
      rawSignals: {
        url: input.url,
        securityStatus,
        domainInfo,
        operatorInfo,
        webSources,
        sourceVerification
      },
      candidateSources
    });

    return {
      analysisLabel,
      oneLineDescription: presentation.oneLineDescription,
      summary: presentation.summary,
      educationalInsight: presentation.educationalInsight,
      sources: presentation.sources.slice(0, 8),
      sourceIntegrityScore: scores.sourceIntegrityScore,
      contentAuthenticityScore: scores.contentAuthenticityScore,
      trustExplainabilityScore: scores.trustExplainabilityScore,
      metadata: {
        domain: domainInfo.domain,
        threats: securityStatus.threats,
        isSafe: securityStatus.isSafe,
        reputationScore: domainInfo.reputationScore,
        ageDays: domainInfo.ageDays
      }
    };
  } catch (error) {
    console.error('Error in URL analysis:', error);
    
    // Return error response with proper format
    return {
      analysisLabel: 'RED',
      oneLineDescription: 'URL analysis encountered an error',
      summary: 'The URL analysis could not be completed due to technical issues. Exercise caution when visiting this URL.',
      educationalInsight: 'When URL analysis fails, manually verify the website using multiple URL scanners and check for HTTPS certificates.',
      sources: [
        { url: 'https://www.virustotal.com/gui/home/url', title: 'VirusTotal URL Scanner', credibility: 0.93 }
      ],
      sourceIntegrityScore: 0,
      contentAuthenticityScore: 0,
      trustExplainabilityScore: 0,
      metadata: {}
    };
  }
}
