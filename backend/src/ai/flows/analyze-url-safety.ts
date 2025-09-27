import { z } from 'zod';
import { WebRiskServiceClient } from '@google-cloud/web-risk';
import { performWebAnalysis } from './perform-web-analysis.js';
import { verifySource } from './verify-source.js';
import { formatUnifiedPresentation } from './format-unified-presentation.js';

const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
];

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

type UrlMetadata = {
  status: number;
  finalUrl: string;
  contentType?: string;
  usesHttps: boolean;
  securityHeaders: string[];
  missingSecurityHeaders: string[];
  meta: {
    title?: string;
    description?: string;
    keywords?: string[];
    language?: string;
    canonical?: string;
    robots?: string;
  };
  headings: string[];
  trackingScripts: string[];
  hasLoginForm: boolean;
  wordCount: number;
  detectedFrameworks: string[];
  fetchError?: string;
};

// Minimal HTML scrubber
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchUrlMetadata(targetUrl: string): Promise<UrlMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UnmaiBot/1.0; +https://unmai.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);

    const finalUrl = response.url || targetUrl;
    const contentType = response.headers.get('content-type') || undefined;
    const headerEntries = SECURITY_HEADERS.filter(h => response.headers.has(h));
    const missingHeaders = SECURITY_HEADERS.filter(h => !response.headers.has(h));

    let html = '';
    if (contentType && /html/i.test(contentType)) {
      try {
        html = await response.text();
      } catch (err) {
        console.error('URL html read failed:', err);
      }
    }

    const meta: UrlMetadata['meta'] = {};
    const headings: string[] = [];
    const trackingScripts: string[] = [];
    let hasLoginForm = false;
    let wordCount = 0;
    const frameworks: string[] = [];

    if (html) {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
      const kwMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']*)["']/i);
      const langMatch = html.match(/<html[^>]+lang=["']([a-zA-Z-]+)["']/i);
      const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i);

      meta.title = titleMatch?.[1]?.trim() || undefined;
      meta.description = descMatch?.[1]?.trim() || undefined;
      meta.language = langMatch?.[1]?.trim() || undefined;
      meta.keywords = kwMatch?.[1]?.split(',').map(k => k.trim()).filter(Boolean);
      meta.canonical = canonicalMatch?.[1]?.trim();
      meta.robots = robotsMatch?.[1]?.trim();

      const headingRegex = /<h[12][^>]*>([^<]+)<\/h[12]>/gi;
      let match;
      while ((match = headingRegex.exec(html)) && headings.length < 10) {
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text) headings.push(text);
      }

      const strip = stripHtml(html);
      wordCount = strip ? strip.split(/\s+/).filter(Boolean).length : 0;

      const loginRegex = /<(form|a)[^>]*(login|sign-?in|account|portal)[^>]*>/i;
      hasLoginForm = loginRegex.test(html);

      const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
      while ((match = scriptRegex.exec(html)) && trackingScripts.length < 15) {
        const src = match[1];
        if (/analytics|ads|tracker|metrics|tagmanager|pixel/i.test(src)) {
          trackingScripts.push(src);
        }
        if (/wp-content|wordpress/i.test(src) && !frameworks.includes('WordPress')) {
          frameworks.push('WordPress');
        }
        if (/cloudflare/i.test(src) && !frameworks.includes('Cloudflare')) {
          frameworks.push('Cloudflare');
        }
      }
      if (/shopify/i.test(html) && !frameworks.includes('Shopify')) frameworks.push('Shopify');
      if (/squarespace/i.test(html) && !frameworks.includes('Squarespace')) frameworks.push('Squarespace');
      if (/wix/i.test(html) && !frameworks.includes('Wix')) frameworks.push('Wix');
    }

    return {
      status: response.status,
      finalUrl,
      contentType,
      usesHttps: finalUrl.startsWith('https://'),
      securityHeaders: headerEntries,
      missingSecurityHeaders: missingHeaders,
      meta,
      headings,
      trackingScripts,
      hasLoginForm,
      wordCount,
      detectedFrameworks: frameworks,
    };
  } catch (error) {
    clearTimeout(timeout);
    console.error('URL metadata fetch failed:', error);
    return {
      status: 0,
      finalUrl: targetUrl,
      usesHttps: targetUrl.startsWith('https://'),
      securityHeaders: [],
      missingSecurityHeaders: SECURITY_HEADERS,
      meta: {},
      headings: [],
      trackingScripts: [],
      hasLoginForm: false,
      wordCount: 0,
      detectedFrameworks: [],
      fetchError: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function deriveUrlRiskInsights(input: {
  securityStatus: Awaited<ReturnType<typeof checkUrlSafety>>;
  domainInfo: ReturnType<typeof analyzeDomain>;
  operatorInfo: ReturnType<typeof getOperatorInfo>;
  metadata: UrlMetadata;
  sourceVerification?: any;
}) {
  const { securityStatus, domainInfo, operatorInfo, metadata, sourceVerification } = input;
  const riskFactors: string[] = [];
  const trustFactors: string[] = [];

  if (!metadata.usesHttps) riskFactors.push('Site does not enforce HTTPS by default.');
  if (metadata.missingSecurityHeaders.includes('content-security-policy')) riskFactors.push('Missing Content-Security-Policy header leaves the site vulnerable to XSS.');
  if (metadata.missingSecurityHeaders.includes('strict-transport-security')) riskFactors.push('Missing HSTS header allows downgrade attacks.');
  if (metadata.hasLoginForm && !metadata.usesHttps) riskFactors.push('Login or account entry detected on non-HTTPS page.');
  if (securityStatus.threats?.length) riskFactors.push(`Web Risk flags: ${securityStatus.threats.join(', ')}`);
  if (metadata.fetchError) riskFactors.push(`Site fetch failed: ${metadata.fetchError}`);

  if (metadata.usesHttps) trustFactors.push('Site responds over HTTPS.');
  if (metadata.securityHeaders.includes('content-security-policy')) trustFactors.push('Content-Security-Policy header is present.');
  if (metadata.securityHeaders.includes('strict-transport-security')) trustFactors.push('HSTS header is enforced.');
  if ((domainInfo.reputationScore || 0) > 0.7) trustFactors.push('Domain reputation from verification service is strong.');
  if (sourceVerification?.sourceVerified) trustFactors.push('Source verification API confirms origin.');

  return { riskFactors, trustFactors };
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
      webSources,
      metadata
    ] = await Promise.all([
      // Web Risk
      checkUrlSafety(input.url),
      // Source verification (backend)
      (async () => {
        try {
          return await verifySource({ content: input.url, contentType: 'url' });
        } catch (e) {
          console.error('verifySource failed:', e);
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
      })(),
      fetchUrlMetadata(input.url)
    ] as const);

    // Derive domain and operator info from URL and verification details
    const domainInfo = analyzeDomain(input.url, sourceVerification);
    const operatorInfo = getOperatorInfo(input.url, sourceVerification);
    const insights = deriveUrlRiskInsights({
      securityStatus,
      domainInfo,
      operatorInfo,
      metadata,
      sourceVerification,
    });

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
      ...(sourceVerification?.relatedSources || []).map((s: any) => ({ url: s.url, title: s.title, relevance: s.similarity })),
      ...(metadata.meta.canonical ? [{ url: metadata.meta.canonical, title: metadata.meta.title || 'Canonical Source', relevance: 80 }] : [])
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
        sourceVerification,
        urlMetadata: metadata,
        riskFactors: insights.riskFactors,
        trustFactors: insights.trustFactors
      },
      candidateSources
    });

    return {
      analysisLabel,
      oneLineDescription: presentation.oneLineDescription,
      summary: presentation.summary,
      educationalInsight: presentation.educationalInsight,
      sources: presentation.sources,
      sourceIntegrityScore: scores.sourceIntegrityScore,
      contentAuthenticityScore: scores.contentAuthenticityScore,
      trustExplainabilityScore: scores.trustExplainabilityScore,
      metadata: {
        domain: domainInfo.domain,
        threats: securityStatus.threats,
        isSafe: securityStatus.isSafe,
        reputationScore: domainInfo.reputationScore,
        ageDays: domainInfo.ageDays,
        status: metadata.status,
        finalUrl: metadata.finalUrl,
        usesHttps: metadata.usesHttps,
        securityHeaders: metadata.securityHeaders,
        missingSecurityHeaders: metadata.missingSecurityHeaders,
        detectedFrameworks: metadata.detectedFrameworks,
        hasLoginForm: metadata.hasLoginForm,
        wordCount: metadata.wordCount
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
