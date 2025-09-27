import { z } from 'zod';
import { SpeechClient } from '@google-cloud/speech';
import { performWebAnalysis } from './perform-web-analysis.js';
import { formatUnifiedPresentation } from './format-unified-presentation.js';
import { factCheckClaim } from './fact-check-claim.js';
import { generativeModel } from '../genkit.js';

const AudioAnalysisInputSchema = z.object({
  audioData: z.string().min(1, 'Audio data is required'),
  mimeType: z.string().optional(),
});
export type AudioAnalysisInput = z.infer<typeof AudioAnalysisInputSchema>;

const AudioAnalysisOutputSchema = z.object({
  // 1. Analysis Label (risk level)
  analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']).describe('Risk level of the content'),
  
  // 2. One-line description (AI polished)
  oneLineDescription: z.string().describe('Brief AI-polished description of the audio'),
  
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
  metadata: z.object({
    format: z.string().optional(),
    duration: z.number().optional(),
    bitrate: z.number().optional(),
    transcription: z.string().optional(),
    factualClaims: z.array(z.object({
      claim: z.string(),
      verdict: z.enum(['VERIFIED', 'DISPUTED', 'UNVERIFIED']),
      confidence: z.number().min(0).max(1),
    })).optional(),
    guidedQueries: z.array(z.string()).optional(),
  }).optional(),
  deepAnalysis: z.object({
    what: z.string(),
    how: z.string(),
    why: z.string(),
    when: z.string(),
    educationalInsights: z.array(z.string()),
  }).optional(),
});
export type AudioAnalysisOutput = z.infer<typeof AudioAnalysisOutputSchema>;

function tryParseJsonLoose(text: string): any {
  try {
    const stripped = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    const candidate = start !== -1 && end !== -1 ? stripped.substring(start, end + 1) : stripped;
    try {
      return JSON.parse(candidate);
    } catch {
      const noTrailingCommas = candidate.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(noTrailingCommas);
    }
  } catch {
    return null;
  }
}

type AudioDeepAnalysisNarrative = {
  what: string;
  how: string;
  why: string;
  when: string;
  educationalInsights: string[];
};

async function buildGeminiGuidedSearchQueries(transcription: string): Promise<string[]> {
  if (!transcription) return [];
  try {
    const prompt = `You assist analysts verifying spoken claims. Based on the transcript below, propose up to five precise web search queries that could help confirm authenticity, origin, or context. Return STRICT JSON:
{
  "queries": ["query one", "query two", ...],
  "notes": "short rationale"
}

Transcript snippet (trim if needed):
${transcription.slice(0, 1200)}`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    const candidate = Array.isArray(parsed?.queries) ? parsed.queries : parsed;
    if (Array.isArray(candidate)) {
      return candidate
        .map((q) => (typeof q === 'string' ? q.trim() : ''))
        .filter((q) => q.length > 0)
        .slice(0, 5);
    }
  } catch (error) {
    console.warn('[WARN] Gemini-guided audio search generation failed:', error);
  }
  return [];
}

function buildReverseAudioQueries(transcription: string, factualClaims: Array<{ claim: string }>): string[] {
  const queries: string[] = [];
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > 0) queries.push(trimmed);
  };

  factualClaims.slice(0, 3).forEach(({ claim }) => add(claim.slice(0, 120)));
  if (transcription) {
    add(transcription.slice(0, 160));
  }

  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = q.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

async function reverseAudioGrounding(
  queries: string[],
  searchEngineId?: string
): Promise<Array<{ title: string; url: string; snippet: string; date: string; relevance: number }>> {
  const results: Array<{ title: string; url: string; snippet: string; date: string; relevance: number }> = [];
  for (const q of queries) {
    try {
      const r = await performWebAnalysis({ query: q, contentType: 'text', searchEngineId });
      if (Array.isArray(r?.currentInformation)) {
        results.push(...r.currentInformation);
      }
    } catch (error) {
      console.warn('[WARN] reverseAudioGrounding query failed:', q, error);
    }
  }

  const byUrl = new Map<string, { title: string; url: string; snippet: string; date: string; relevance: number }>();
  for (const item of results) {
    if (item?.url && !byUrl.has(item.url)) {
      byUrl.set(item.url, item);
    }
  }
  return Array.from(byUrl.values()).slice(0, 12);
}

async function generateDeepAnalysisNarrative(params: {
  transcription: string;
  factualClaims: Array<{ claim: string; verdict: string; confidence: number }>;
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  existingEducationalInsight?: string;
  sources: Array<{ url: string; title: string }>;
}): Promise<AudioDeepAnalysisNarrative> {
  try {
    const prompt = `You extend an audio misinformation report with educational framing. Using the structured context below, output STRICT JSON:
{
  "what": "Summarize what is said in the audio",
  "how": "Explain delivery techniques, manipulation signs, or verification notes",
  "why": "Discuss motives or impact",
  "when": "Temporal cues or situational context",
  "educationalInsights": ["Actionable media literacy tips"]
}

Structured context:
${JSON.stringify({
  transcription: params.transcription,
  claims: params.factualClaims,
  analysisLabel: params.analysisLabel,
  sources: params.sources,
  existingEducationalInsight: params.existingEducationalInsight,
}).slice(0, 4000)}`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    if (parsed && typeof parsed === 'object') {
      const narrative: AudioDeepAnalysisNarrative = {
        what: String(parsed.what || '').trim() || 'Detailed description unavailable.',
        how: String(parsed.how || '').trim() || 'Delivery techniques could not be determined.',
        why: String(parsed.why || '').trim() || 'Motivations remain unclear.',
        when: String(parsed.when || '').trim() || 'Temporal context not evident.',
        educationalInsights: Array.isArray(parsed.educationalInsights)
          ? parsed.educationalInsights.map((v: any) => String(v || '').trim()).filter((v: string) => v.length > 0)
          : [],
      };

      if (narrative.educationalInsights.length === 0 && params.existingEducationalInsight) {
        narrative.educationalInsights = [params.existingEducationalInsight];
      }

      return narrative;
    }
  } catch (error) {
    console.warn('[WARN] Gemini audio deep analysis narrative failed:', error);
  }

  const fallbackInsight = params.existingEducationalInsight
    ? [params.existingEducationalInsight]
    : ['Cross-check audio claims with reputable reporting and look for official transcripts.'];

  return {
    what: 'Detailed description unavailable due to limited context.',
    how: 'Possible manipulation techniques could not be identified.',
    why: 'The motivation or impact of this audio is uncertain.',
    when: 'Temporal context could not be inferred from the audio.',
    educationalInsights: fallbackInsight,
  };
}

// Helper to transcribe audio using Google Speech-to-Text
async function transcribeAudio(audioData: string, mimeType?: string) {
  const client = new SpeechClient();
  const audio = {
    content: audioData.includes('base64') ? Buffer.from(audioData.split(',')[1], 'base64') : audioData,
  };

  const encodingMap = {
    'audio/mp3': 'MP3',
    'audio/mpeg': 'MP3',
    'audio/wav': 'LINEAR16',
    'audio/x-wav': 'LINEAR16',
    'audio/flac': 'FLAC',
    'audio/ogg': 'OGG_OPUS',
    'audio/ogg; codecs=opus': 'OGG_OPUS',
    'audio/amr': 'AMR',
    'audio/awb': 'AMR_WB',
  } as const;
  type Encoding = typeof encodingMap[keyof typeof encodingMap];
  const sampleRateMap: Partial<Record<Encoding, number>> = {
    OGG_OPUS: 48000,
    AMR: 8000,
    AMR_WB: 16000,
    LINEAR16: 16000,
  };

  const encodingFromMime: Encoding = (mimeType && (mimeType in encodingMap)
    ? encodingMap[mimeType as keyof typeof encodingMap]
    : 'LINEAR16');
  const sampleRateHertz = sampleRateMap[encodingFromMime];

  const config: any = {
    encoding: encodingFromMime,
    languageCode: 'en-US',
    enableAutomaticPunctuation: true,
  };

  if (sampleRateHertz) {
    config.sampleRateHertz = sampleRateHertz;
  }

  const request = { audio, config };

  try {
    const [response] = await client.recognize(request);
    return response.results
      ?.map(result => result.alternatives?.[0]?.transcript || '')
      .join('\n') || '';
  } catch (error) {
    console.error('Speech-to-Text error:', error);
    return '';
  }
}

// Helper to extract and fact-check claims from transcription (heuristic extraction)
async function extractAndFactCheckClaims(
  transcription: string
): Promise<Array<{
  claim: string;
  verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED';
  confidence: number;
}>> {
  if (!transcription || transcription.length < 10) {
    return [];
  }
  const sentences = transcription
    .replace(/\s+/g, ' ')
    .split(/(?<=[\.!\?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  const factualRegex = /(\bis\b|\bare\b|\bwas\b|\bwere\b|\bhas\b|\bhave\b|\bclaims?\b|\breports?\b|\baccording to\b|\bpercent|\b\d{4}\b)/i;
  const claims = Array.from(new Set(sentences.filter(s => s.length > 20 && factualRegex.test(s)))).slice(0, 5);
  const factCheckedClaims = await Promise.all(
    claims.map(async (claim) => {
      try {
        const result = await factCheckClaim({ claim });
        return {
          claim,
          verdict: result.verdict === 'True' ? 'VERIFIED' as const :
                  result.verdict === 'False' ? 'DISPUTED' as const : 'UNVERIFIED' as const,
          confidence: result.verdict === 'Uncertain' ? 0.3 : 0.7,
        };
      } catch {
        return { claim, verdict: 'UNVERIFIED' as const, confidence: 0.3 };
      }
    })
  );
  return factCheckedClaims;
}

// Authenticity derived from fact-check results (no LLM)
function deriveAudioAuthenticity(factualClaims: Array<{ verdict: string; confidence: number }>) {
  const total = Math.max(1, factualClaims.length);
  const verified = factualClaims.filter(c => c.verdict === 'VERIFIED').length;
  const disputed = factualClaims.filter(c => c.verdict === 'DISPUTED').length;
  const isAuthentic = disputed <= verified;
  const confidence = Math.min(1, Math.max(0, (verified - disputed) / total * 0.5 + 0.5));
  return {
    isAuthentic,
    confidence,
    explanation: 'Derived from verification results of transcribed claims.',
    indicators: [] as string[],
  };
}

// Helper to calculate comprehensive scores
function calculateScores(
  factualClaims: Array<{ verdict: string; confidence: number }>,
  authenticityAnalysis: { isAuthentic: boolean; confidence: number },
  webSources: number
): {
  sourceIntegrityScore: number;
  contentAuthenticityScore: number;
  trustExplainabilityScore: number;
} {
  const totalClaims = Math.max(1, factualClaims.length);
  const verifiedClaims = factualClaims.filter(c => c.verdict === 'VERIFIED').length;
  const disputedClaims = factualClaims.filter(c => c.verdict === 'DISPUTED').length;

  // Source Integrity Score (based on verification rate and web sources)
  const verificationRate = verifiedClaims / totalClaims;
  const sourceBoost = Math.min(20, webSources * 5); // Up to 20 points for sources
  const sourceIntegrityScore = Math.round(verificationRate * 80 + sourceBoost);

  // Content Authenticity Score
  const baseAuthenticity = authenticityAnalysis.isAuthentic ? 70 : 20;
  const confidenceBoost = authenticityAnalysis.confidence * 30;
  const disputePenalty = (disputedClaims / totalClaims) * 20;
  const contentAuthenticityScore = Math.round(Math.max(0, baseAuthenticity + confidenceBoost - disputePenalty));

  // Trust Explainability Score (average of other scores with confidence factor)
  const avgConfidence = factualClaims.reduce((sum, c) => sum + c.confidence, 0) / totalClaims;
  const trustExplainabilityScore = Math.round(
    (sourceIntegrityScore * 0.4 + contentAuthenticityScore * 0.4 + avgConfidence * 100 * 0.2)
  );

  return {
    sourceIntegrityScore: Math.min(100, sourceIntegrityScore),
    contentAuthenticityScore: Math.min(100, contentAuthenticityScore),
    trustExplainabilityScore: Math.min(100, trustExplainabilityScore),
  };
}

// Main analysis function
export async function analyzeAudioContent(input: AudioAnalysisInput, options?: { searchEngineId?: string }): Promise<AudioAnalysisOutput> {
  try {
    // Step 1: Transcribe audio
    const transcription = await transcribeAudio(input.audioData, input.mimeType);

    if (!transcription) {
      throw new Error('Failed to transcribe audio');
    }

    // Step 2: Extract and fact-check claims
    const factualClaims = await extractAndFactCheckClaims(transcription);

    // Step 3: Analyze authenticity (derived, non-LLM)
    const authenticityAnalysis = deriveAudioAuthenticity(factualClaims);

    // Step 4: Perform web analysis for context
    let webSources: any[] = [];
    try {
      const webAnalysis = await performWebAnalysis({
        query: transcription.substring(0, 500),
        contentType: 'text',
        searchEngineId: options?.searchEngineId
      });
      webSources = webAnalysis.currentInformation || [];
    } catch (error) {
      console.error('Web analysis failed:', error);
    }

    // Step 4b: Augment with Gemini-guided reverse grounding queries
    let guidedQueries: string[] = [];
    try {
      const geminiQueries = await buildGeminiGuidedSearchQueries(transcription);
      const reverseQueries = buildReverseAudioQueries(transcription, factualClaims);
      const combinedQueries = Array.from(new Set([...reverseQueries, ...geminiQueries]));
      guidedQueries = combinedQueries;
      if (combinedQueries.length > 0) {
        const reverseSources = await reverseAudioGrounding(combinedQueries, options?.searchEngineId);
        if (reverseSources.length > 0) {
          const byUrl = new Map<string, any>();
          for (const s of webSources) if (s?.url) byUrl.set(s.url, s);
          for (const s of reverseSources) if (s?.url && !byUrl.has(s.url)) byUrl.set(s.url, s);
          webSources = Array.from(byUrl.values());
        }
      }
    } catch (error) {
      console.warn('[WARN] Guided reverse audio search failed:', error);
    }

    // Step 5: Determine analysis label based on results
    let analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN' = 'YELLOW';
    const verifiedClaims = factualClaims.filter(c => c.verdict === 'VERIFIED').length;
    const disputedClaims = factualClaims.filter(c => c.verdict === 'DISPUTED').length;
    const totalClaims = Math.max(1, factualClaims.length);

    if (!authenticityAnalysis.isAuthentic || disputedClaims > totalClaims * 0.5) {
      analysisLabel = 'RED';
    } else if (verifiedClaims === totalClaims && authenticityAnalysis.confidence > 0.7) {
      analysisLabel = 'GREEN';
    } else if (disputedClaims > 0 || authenticityAnalysis.confidence < 0.5) {
      analysisLabel = 'ORANGE';
    }

    // Step 6: Calculate scores
    const scores = calculateScores(factualClaims, authenticityAnalysis, (webSources?.length || 0));

    // Step 7: Gemini-driven formatting of presentation fields and sources
    const candidateSources = (webSources || []).map((s: any) => ({ url: s.url, title: s.title, snippet: s.snippet, relevance: s.relevance }));
    const presentation = await formatUnifiedPresentation({
      contentType: 'audio',
      analysisLabel,
      rawSignals: {
        transcription,
        factualClaims,
        authenticityAnalysis,
        webSources
      },
      candidateSources
    });

    const deepAnalysis = await generateDeepAnalysisNarrative({
      transcription,
      factualClaims,
      analysisLabel,
      existingEducationalInsight: presentation.educationalInsight,
      sources: (presentation.sources || []).map((source: any) => ({
        url: source.url,
        title: source.title,
      })),
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
        format: input.mimeType || 'audio/wav',
        duration: 0,
        bitrate: 0,
        transcription,
        factualClaims,
        guidedQueries,
      },
      deepAnalysis,
    };
  } catch (error) {
    console.error('Error in audio analysis:', error);

    // Return error response with proper format
    return {
      analysisLabel: 'RED',
      oneLineDescription: 'Audio analysis encountered an error',
      summary: 'The audio analysis could not be completed due to technical issues. Please try again or verify the audio format.',
      educationalInsight: 'When audio analysis fails, it could indicate corrupted files, unsupported formats, or network issues. Always ensure audio files are in standard formats (MP3, WAV, M4A) and not corrupted.',
      sources: [
        {
          url: 'https://support.google.com/websearch/answer/2466433',
          title: 'Google - How to verify information online',
          credibility: 0.9
        }
      ],
      sourceIntegrityScore: 0,
      contentAuthenticityScore: 0,
      trustExplainabilityScore: 0,
      metadata: {
        format: input.mimeType || 'unknown',
        duration: 0,
        bitrate: 0
      },
      deepAnalysis: {
        what: 'Audio analysis unavailable due to an internal error.',
        how: 'Processing steps failed before deep insights were produced.',
        why: 'Unable to infer motivations or impact without a successful transcript.',
        when: 'Temporal context could not be derived.',
        educationalInsights: [
          'Retry later and corroborate spoken claims with trustworthy written sources.'
        ],
      }
    };
  }
}
