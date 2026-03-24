import { z } from 'zod';
import { WebRiskServiceClient } from '@google-cloud/web-risk';
import { performWebAnalysis } from './perform-web-analysis.js';
import { getAuthConfig } from '../auth.js';
import { groundedModel } from '../genkit.js';

const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
];

const UrlAnalysisInputSchema = z.object({
  url: z.string().min(1, 'Input is required'),
});
export type UrlAnalysisInput = z.infer<typeof UrlAnalysisInputSchema>;

const UrlAnalysisOutputSchema = z.object({
  analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']).describe('Risk level of the URL'),
  oneLineDescription: z.string().describe('Brief AI-polished description of the URL'),
  summary: z.string().describe('Detailed AI-polished summary of the analysis'),
  educationalInsight: z.string().describe('AI-polished educational content on URL safety'),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    credibility: z.number().min(0).max(1),
  })).describe('Factual and legitimate web sources'),
  sourceIntegrityScore: z.number().min(0).max(100).describe('Source integrity score'),
  contentAuthenticityScore: z.number().min(0).max(100).describe('Content authenticity score'),
  trustExplainabilityScore: z.number().min(0).max(100).describe('Trust explainability score'),
  metadata: z.object({
    domain: z.string().optional(),
    threats: z.array(z.string()).optional(),
    isSafe: z.boolean().optional(),
    isReachable: z.boolean().optional(),
    status: z.number().optional(),
    finalUrl: z.string().optional(),
    usesHttps: z.boolean().optional(),
    securityHeaders: z.array(z.string()).optional(),
    missingSecurityHeaders: z.array(z.string()).optional(),
    detectedFrameworks: z.array(z.string()).optional(),
    hasLoginForm: z.boolean().optional(),
    wordCount: z.number().optional(),
  }).optional(),
});
export type UrlAnalysisOutput = z.infer<typeof UrlAnalysisOutputSchema>;

/**
 * Utility to extract the first valid URL from a string
 */
function extractUrl(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const match = text.match(urlRegex);
  if (match && match.length > 0) {
    try {
      // Validate with URL constructor
      const url = new URL(match[0]);
      return url.toString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Check URL safety using Google Web Risk API
 */
async function checkUrlSafety(url: string) {
  try {
    const client = new WebRiskServiceClient(getAuthConfig());
    const request = {
      uri: url,
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'] as unknown as string[],
    };

    const [response] = await client.searchUris(request as any);

    if (response.threat && response.threat.threatTypes) {
      return {
        isSafe: false,
        threats: response.threat.threatTypes.map((t: any) => String(t)),
        confidence: 0.98,
      };
    }
    return {
      isSafe: true,
      threats: [],
      confidence: 0.95,
    };
  } catch (error) {
    console.error('[WebRisk] API error:', error);
    return {
      isSafe: true, // Fail-soft on API error but with low confidence
      threats: [],
      confidence: 0.5,
      error: 'Web Risk API unavailable',
    };
  }
}

type UrlMetadata = {
  isReachable: boolean;
  status: number;
  finalUrl: string;
  contentType?: string;
  usesHttps: boolean;
  securityHeaders: string[];
  missingSecurityHeaders: string[];
  meta: {
    title?: string;
    description?: string;
  };
  hasLoginForm: boolean;
  wordCount: number;
  detectedFrameworks: string[];
  error?: string;
};

/**
 * Fetch URL metadata with robust error handling for "Fail-Open" prevention
 */
async function fetchUrlMetadata(targetUrl: string): Promise<UrlMetadata> {
  const controller = new AbortController();
  // Slightly longer timeout for metadata fetch
  const timeout = setTimeout(() => controller.abort(), 12000);
  const startTime = Date.now();

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Using a more standard browser User-Agent to avoid being blocked by some sites
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);
    const duration = Date.now() - startTime;
    console.log(`[Fetch] Metadata for ${targetUrl} fetched in ${duration}ms`);

    const finalUrl = response.url || targetUrl;
    const headerEntries = SECURITY_HEADERS.filter(h => response.headers.has(h));
    const missingHeaders = SECURITY_HEADERS.filter(h => !response.headers.has(h));
    
    let html = '';
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      html = await response.text();
    }

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);

    return {
      isReachable: true,
      status: response.status,
      finalUrl,
      usesHttps: finalUrl.startsWith('https://'),
      securityHeaders: headerEntries,
      missingSecurityHeaders: missingHeaders,
      meta: {
        title: titleMatch?.[1]?.trim(),
        description: descMatch?.[1]?.trim(),
      },
      hasLoginForm: /type=["']password["']/i.test(html) || /<form[^>]*login/i.test(html),
      wordCount: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
      detectedFrameworks: [], // Simplified for this refactor
    };
  } catch (error: any) {
    clearTimeout(timeout);
    const duration = Date.now() - startTime;
    console.error(`[Fetch] URL metadata failed after ${duration}ms:`, error.message);
    
    let errorMessage = 'Site is unreachable';
    if (error.code === 'ENOTFOUND') errorMessage = 'DNS lookup failed or site is offline';
    if (error.code === 'ECONNREFUSED') errorMessage = 'Connection refused by the server';
    if (error.name === 'AbortError') errorMessage = 'Connection timed out';

    return {
      isReachable: false,
      status: 0,
      finalUrl: targetUrl,
      usesHttps: targetUrl.startsWith('https://'),
      securityHeaders: [],
      missingSecurityHeaders: SECURITY_HEADERS,
      meta: {},
      hasLoginForm: false,
      wordCount: 0,
      detectedFrameworks: [],
      error: errorMessage,
    };
  }
}

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

/**
 * Strict Evaluation using Gemini
 */
async function evaluateUrlWithGemini(data: {
  url: string;
  isReachable: boolean;
  webRiskThreat: string | null;
  metadata: UrlMetadata;
  sourceVerification?: any;
}) {
  const startTime = Date.now();
  const prompt = `You are a professional URL security analyst. Analyze the following signals and provide a safety assessment.

REQUIRED JSON SCHEMA:
{
  "url": string,
  "isReachable": boolean,
  "webRiskThreat": string | null,
  "verdict": "Safe" | "Suspicious" | "Malicious" | "Unreachable",
  "trustScore": number,
  "explanation": string,
  "educationalTip": string
}

SIGNALS:
- URL: ${data.url}
- Reachable: ${data.isReachable}
- Web Risk Threat: ${data.webRiskThreat || 'None'}
- HTTP Status: ${data.metadata.status}
- HTTPS: ${data.metadata.usesHttps}
- Security Headers: ${data.metadata.securityHeaders.join(', ') || 'None'}
- Source Verification: ${JSON.stringify(data.sourceVerification || {})}

SCORING RULES:
1. Web Risk Threat Detected ➔ trustScore: 0, verdict: "Malicious"
2. Not Reachable (ENOTFOUND/Timeout) ➔ trustScore: 10, verdict: "Unreachable"
3. Reachable, No Web Risk, but Poor Reputation ➔ trustScore: 20-40, verdict: "Suspicious"
4. Safe, HTTPS, Strong Reputation ➔ trustScore: 80-100, verdict: "Safe"

Output ONLY the JSON.`;

  try {
    const result = await groundedModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    });
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = tryParseJsonLoose(text);
    if (!parsed) throw new Error('Failed to parse Gemini evaluation JSON');
    console.log(`[Gemini] Evaluation completed in ${Date.now() - startTime}ms`);
    return parsed;
  } catch (e) {
    console.error(`[Gemini] Evaluation failed after ${Date.now() - startTime}ms:`, e);
    // Secure fallback
    return {
      url: data.url,
      isReachable: data.isReachable,
      webRiskThreat: data.webRiskThreat,
      verdict: data.webRiskThreat ? 'Malicious' : (data.isReachable ? 'Suspicious' : 'Unreachable'),
      trustScore: data.webRiskThreat ? 0 : (data.isReachable ? 40 : 10),
      explanation: 'Automated evaluation failed. Site safety cannot be confirmed.',
      educationalTip: 'Always use a sandbox or VPN when visiting unfamiliar URLs.'
    };
  }
}

/**
 * Main URL Safety Analysis Flow
 */
export async function analyzeUrlSafety(input: UrlAnalysisInput, options?: { searchEngineId?: string }): Promise<UrlAnalysisOutput> {
  const flowStartTime = Date.now();
  try {
    // 1. Extract URL Cleanly
    const targetUrl = extractUrl(input.url);
    if (!targetUrl) {
      throw new Error('No valid URL found in input');
    }

    // 2. Web Risk FIRST (Pre-fetch safety check)
    const securityStartTime = Date.now();
    const securityStatus = await checkUrlSafety(targetUrl);
    console.log(`[WebRisk] Check completed in ${Date.now() - securityStartTime}ms`);
    
    // 3. Halt if Web Risk flags the URL (Fail-Closed)
    if (!securityStatus.isSafe) {
      return {
        analysisLabel: 'RED',
        oneLineDescription: 'Malicious URL detected - high risk of malware or phishing',
        summary: `This URL has been flagged as malicious by security services. Detected threats: ${securityStatus.threats.join(', ')}. Visiting this site may compromise your device or personal information.`,
        educationalInsight: 'Malicious URLs often use techniques like social engineering, malware distribution, and unwanted software installation. To protect yourself: (1) Never click on suspicious links, (2) Use a reputable URL scanner before visiting unknown sites, (3) Keep your browser and security software up to date, (4) Check the domain name carefully for typos (typosquatting).',
        sources: [
          { url: 'https://www.virustotal.com/gui/home/url', title: 'VirusTotal URL Scanner', credibility: 0.98 },
          { url: 'https://safebrowsing.google.com/', title: 'Google Safe Browsing', credibility: 0.99 }
        ],
        sourceIntegrityScore: 0,
        contentAuthenticityScore: 0,
        trustExplainabilityScore: 98,
        metadata: {
          domain: new URL(targetUrl).hostname,
          threats: securityStatus.threats,
          isSafe: false,
          isReachable: true
        }
      };
    }

    // 4. Proceed only if Web Risk is Safe
    console.log('[Flow] Web Risk safe, proceeding with parallel analysis...');
    const parallelStartTime = Date.now();
    
    // We run metadata fetch and web search in parallel
    // We REMOVED verifySource from here to combine it into the final Gemini call
    const [metadata, webSources] = await Promise.all([
      fetchUrlMetadata(targetUrl),
      performWebAnalysis({ query: targetUrl, contentType: 'url', searchEngineId: options?.searchEngineId }).catch(() => ({ currentInformation: [] }))
    ]);
    console.log(`[Flow] Parallel analysis completed in ${Date.now() - parallelStartTime}ms`);

    // 5. Ultimate Analysis & Presentation (Combined Gemini Call)
    const analysisStartTime = Date.now();
    
    const prompt = `You are an elite cyber-security analyst and source verification expert.
Analyze the following signals for the URL: ${targetUrl}

REQUIRED JSON OUTPUT SCHEMA:
{
  "verdict": "Safe" | "Suspicious" | "Malicious" | "Unreachable",
  "trustScore": number (0-100),
  "oneLineDescription": "Brief catchy safety summary",
  "summary": "Detailed technical and reputational analysis (at least 3 sentences)",
  "educationalInsight": "Security best practices based on these findings",
  "sources": [
    { "url": "string", "title": "string", "credibility": number (0-1) }
  ],
  "sourceVerification": {
    "isVerified": boolean,
    "credibilityScore": number,
    "details": "Reputation and origin details"
  }
}

SIGNALS:
- Reachable: ${metadata.isReachable}
- HTTP Status: ${metadata.status}
- HTTPS: ${metadata.usesHttps}
- Security Headers: ${metadata.securityHeaders.join(', ') || 'None'}
- Missing Headers: ${metadata.missingSecurityHeaders.join(', ') || 'None'}
- Web Search Results: ${JSON.stringify(webSources.currentInformation).slice(0, 3000)}

SCORING & ANALYSIS RULES:
1. Verify the site's reputation based on search results.
2. Check for technical security indicators (HTTPS, Headers).
3. If search results mention scams, phishing, or malware ➔ verdict: Malicious, trustScore < 20.
4. If site is unreachable ➔ verdict: Unreachable, trustScore: 10.
5. If site is new or has no search reputation ➔ verdict: Suspicious, trustScore: 30-50.
6. If site is well-known and technically secure ➔ verdict: Safe, trustScore: 80-100.
7. For sources, pick the most relevant ones from the search results.

IMPORTANT: Use your internal knowledge and the provided search results to verify the source.
Output ONLY valid JSON.`;

    let evaluation;
    try {
      // NOTE: Cannot use responseMimeType: 'application/json' with tools (googleSearch).
      // Gemini rejects this combination. Use text response + JSON parsing instead.
      const result = await groundedModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
        tools: [{ googleSearch: {} }]
      });
      const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      evaluation = tryParseJsonLoose(text);
      if (!evaluation || !evaluation.verdict) throw new Error('Invalid analysis JSON');
      console.log(`[Gemini] Combined analysis & presentation completed in ${Date.now() - analysisStartTime}ms`);
    } catch (e) {
      console.error(`[Gemini] Combined analysis failed:`, e);
      // Fallback
      evaluation = {
        verdict: metadata.isReachable ? 'Suspicious' : 'Unreachable',
        trustScore: metadata.isReachable ? 40 : 10,
        oneLineDescription: 'Automated evaluation partially failed',
        summary: 'We were unable to perform a full reputation check, but technical signals are available.',
        educationalInsight: 'Always verify unfamiliar sites manually.',
        sources: [],
        sourceVerification: { isVerified: false, credibilityScore: 0, details: 'Verification failed' }
      };
    }

    // 6. Map verdict to Label
    const labelMap: Record<string, 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN'> = {
      'Malicious': 'RED',
      'Unreachable': 'ORANGE',
      'Suspicious': 'YELLOW',
      'Safe': 'GREEN'
    };
    const analysisLabel = labelMap[evaluation.verdict] || 'YELLOW';

    // 7. Final response construction (No more sequential Gemini calls!)
    console.log(`[Flow] Total analyzeUrlSafety duration: ${Date.now() - flowStartTime}ms`);
    
    // Ensure we have at least 3 sources (fallback to defaults if needed)
    const finalSources = (evaluation.sources || []).length >= 3 
      ? evaluation.sources.slice(0, 5)
      : [
          ... (evaluation.sources || []),
          { url: 'https://www.snopes.com', title: 'Snopes - Fact Checking', credibility: 0.95 },
          { url: 'https://www.factcheck.org', title: 'FactCheck.org - Nonpartisan Analysis', credibility: 0.93 },
          { url: 'https://www.politifact.com', title: 'PolitiFact - Truth-O-Meter', credibility: 0.91 }
        ].slice(0, 5);

    return {
      analysisLabel,
      oneLineDescription: evaluation.oneLineDescription,
      summary: evaluation.summary,
      educationalInsight: evaluation.educationalInsight,
      sources: finalSources,
      sourceIntegrityScore: evaluation.trustScore,
      contentAuthenticityScore: evaluation.sourceVerification?.credibilityScore || evaluation.trustScore,
      trustExplainabilityScore: Math.round(securityStatus.confidence * 100),
      metadata: {
        domain: new URL(targetUrl).hostname,
        threats: [],
        isSafe: true,
        isReachable: metadata.isReachable,
        status: metadata.status,
        finalUrl: metadata.finalUrl,
        usesHttps: metadata.usesHttps,
        securityHeaders: metadata.securityHeaders,
        missingSecurityHeaders: metadata.missingSecurityHeaders,
        hasLoginForm: metadata.hasLoginForm,
        wordCount: metadata.wordCount
      }
    };



  } catch (error: any) {
    console.error(`[Flow] URL analysis failed after ${Date.now() - flowStartTime}ms:`, error.message);
    return {
      analysisLabel: 'RED',
      oneLineDescription: 'URL analysis encountered a fatal error',
      summary: `The analysis failed: ${error.message}. Do not trust this URL.`,
      educationalInsight: 'Check for typos in the URL and ensure the site is legitimate before proceeding.',
      sources: [],
      sourceIntegrityScore: 0,
      contentAuthenticityScore: 0,
      trustExplainabilityScore: 0,
      metadata: {}
    };
  }
}

