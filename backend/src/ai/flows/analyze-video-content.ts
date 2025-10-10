import { z } from 'zod';
import { groundedModel, generativeModel, generativeVisionModel } from '../genkit.js';
import { v1 as videoIntelligence, protos as viProtos } from '@google-cloud/video-intelligence';
import { performWebAnalysis } from './perform-web-analysis.js';
import { formatUnifiedPresentation } from './format-unified-presentation.js';
import { detectDeepfake } from './detect-deepfake.js';

// Cache for storing analysis results (5 minute TTL)
const analysisCache = new Map<string, { timestamp: number; result: any }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const VideoAnalysisInputSchema = z.object({
  videoData: z.string().min(1, 'Video data is required'), // Base64 or GCS URL
  mimeType: z.string().optional(),
});
export type VideoAnalysisInput = z.infer<typeof VideoAnalysisInputSchema>;

const VideoAnalysisOutputSchema = z.object({
  // 1. Analysis Label (risk level)
  analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']).describe('Risk level of the content'),
  
  // 2. One-line description (AI polished)
  oneLineDescription: z.string().describe('Brief AI-polished description of the video'),
  
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
    location: z.string().optional(),
    transcription: z.string().optional(),
    events: z.array(z.string()).optional(),
    isManipulated: z.boolean().optional(),
    technicalData: z.record(z.unknown()).optional(),
  }).optional(),
  deepAnalysis: z.object({
    what: z.string(),
    how: z.string(),
    why: z.string(),
    when: z.string(),
    educationalInsights: z.array(z.string()),
  }).optional(),
});
export type VideoAnalysisOutput = z.infer<typeof VideoAnalysisOutputSchema>;

// Consolidated Video Intelligence API analysis (metadata + transcription + events)
async function analyzeVideoIntelligence(videoData: string) {
  const client = new videoIntelligence.VideoIntelligenceServiceClient();
  const request = {
    inputUri: videoData.startsWith('gs://') ? videoData : undefined,
    inputContent: videoData.startsWith('data:') ? Buffer.from(videoData.split(',')[1], 'base64') : undefined,
    features: [
      viProtos.google.cloud.videointelligence.v1.Feature.LABEL_DETECTION,
      viProtos.google.cloud.videointelligence.v1.Feature.SPEECH_TRANSCRIPTION,
    ],
    videoContext: {
      speechTranscriptionConfig: {
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
      },
    },
  } as any;

  try {
    const [operation] = await client.annotateVideo(request);
    const [result] = await operation.promise();
    const annotations = result.annotationResults?.[0];
    return {
      transcription: annotations?.speechTranscriptions?.[0]?.alternatives?.[0]?.transcript || '',
      events: annotations?.segmentLabelAnnotations?.map(a => a.entity?.description || '').filter(Boolean) || [],
      location: annotations?.segmentLabelAnnotations?.[0]?.entity?.description || 'Unknown',
      technicalData: { inputUri: annotations?.inputUri || 'Unknown' },
    };
  } catch (error) {
    console.error('Video Intelligence analysis error:', error);
    return { transcription: '', events: [], location: 'Unknown', technicalData: { error: 'Analysis failed' } };
  }
}

// Build a file part for Gemini/Vertex AI based on the provided video data
function buildVideoPart(videoData: string, mimeType?: string): any {
  // data:[mime];base64,<...>
  if (videoData.startsWith('data:')) {
    const commaIdx = videoData.indexOf(',');
    const header = videoData.substring(5, commaIdx); // e.g., video/mp4;base64
    const derivedMime = header.split(';')[0] || 'video/mp4';
    const base64Data = videoData.substring(commaIdx + 1);
    return {
      inlineData: {
        mimeType: mimeType || derivedMime || 'video/mp4',
        data: base64Data,
      },
    };
  }
  // For GCS or HTTP(S) URIs, pass as fileUri
  if (videoData.startsWith('gs://') || videoData.startsWith('http://') || videoData.startsWith('https://')) {
    return {
      fileData: {
        fileUri: videoData,
        mimeType: mimeType || 'video/mp4',
      },
    };
  }
  // Fallback: treat as opaque reference; model may not fetch it, but we'll still proceed
  return {
    fileData: {
      fileUri: videoData,
      mimeType: mimeType || 'video/mp4',
    },
  };
}

// Minimal, resilient JSON cleaner to parse model outputs that may include code fences/noise
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
      // Attempt to remove trailing commas
      const noTrailingCommas = candidate.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(noTrailingCommas);
    }
  } catch (e) {
    return null;
  }
}

type GeminiVideoUnderstanding = {
  contentDescription: string;
  technicalAssessment: any;
  contextualInfo: {
    recognizedText?: string[];
    brands?: string[];
    logos?: string[];
    locations?: string[];
  };
  authenticityScore: number; // 0-100 (higher means more likely authentic)
  potentialIssues: string[];
  recommendedFactChecks: string[];
  transcription: string;
  events: string[];
};

type DeepAnalysisNarrative = {
  what: string;
  how: string;
  why: string;
  when: string;
  educationalInsights: string[];
};

async function buildGeminiGuidedSearchQueries(
  understanding: GeminiVideoUnderstanding,
  transcription: string
): Promise<string[]> {
  try {
    const prompt = `You are assisting with targeted OSINT research for a misinformation analysis task.

Given the following structured context, propose up to five highly specific web search queries that would help verify authenticity, origin, and credibility:

Context JSON:
${JSON.stringify({
  description: understanding?.contentDescription || '',
  events: understanding?.events || [],
  transcription,
  recognizedText: understanding?.contextualInfo?.recognizedText || [],
  locations: understanding?.contextualInfo?.locations || [],
  potentialIssues: understanding?.potentialIssues || [],
})}

Return STRICT JSON in the format:
{
  "queries": ["query one", "query two", ...],
  "rationale": "short explanation of how these help"
}`;

    const result = await generativeModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });

    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    if (!parsed) {
      return [];
    }

    const queriesCandidate = Array.isArray(parsed?.queries) ? parsed.queries : parsed;
    if (Array.isArray(queriesCandidate)) {
      return queriesCandidate
        .map((q) => (typeof q === 'string' ? q.trim() : ''))
        .filter((q) => q.length > 0)
        .slice(0, 5);
    }
  } catch (error) {
    console.warn('[WARN] Gemini-guided search query generation failed:', error);
  }
  return [];
}

async function generateDeepAnalysisNarrative(params: {
  transcription: string;
  events: string[];
  understanding: GeminiVideoUnderstanding;
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  existingEducationalInsight?: string;
  sources: Array<{ url: string; title: string }>;
}): Promise<DeepAnalysisNarrative> {
  try {
    const prompt = `You are an educational analyst expanding a misinformation screening report.

Using the structured context below, produce STRICT JSON with:
{
  "what": "Concise description of what is happening in the video",
  "how": "Explain how the events unfold or the technique used",
  "why": "Explain why the content might exist or be impactful",
  "when": "Describe temporal clues or context",
  "educationalInsights": ["Actionable media literacy insight", ...]
}

Structured context:
${JSON.stringify({
  transcription: params.transcription,
  events: params.events,
  understanding: params.understanding,
  analysisLabel: params.analysisLabel,
  sources: params.sources,
  existingEducationalInsight: params.existingEducationalInsight,
})}`;

    const result = await generativeModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });

    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    if (parsed && typeof parsed === 'object') {
      const narrative: DeepAnalysisNarrative = {
        what: String(parsed.what || '').trim() || 'Detailed description unavailable.',
        how: String(parsed.how || '').trim() || 'How the events unfold could not be determined.',
        why: String(parsed.why || '').trim() || 'Motivation for the content remains unclear.',
        when: String(parsed.when || '').trim() || 'Temporal context could not be derived.',
        educationalInsights: Array.isArray(parsed.educationalInsights)
          ? parsed.educationalInsights
              .map((ins: any) => String(ins || '').trim())
              .filter((ins: string) => ins.length > 0)
          : [],
      };

      if (narrative.educationalInsights.length === 0 && params.existingEducationalInsight) {
        narrative.educationalInsights = [params.existingEducationalInsight];
      }

      return narrative;
    }
  } catch (error) {
    console.warn('[WARN] Gemini deep analysis narrative generation failed:', error);
  }

  const fallbackInsight = params.existingEducationalInsight
    ? [params.existingEducationalInsight]
    : ['Cross-verify video claims with reputable sources and look for corroborating evidence.'];

  return {
    what: 'Detailed description unavailable due to limited context.',
    how: 'How the events unfold could not be determined from the available data.',
    why: 'The motive or intent behind the content remains unclear.',
    when: 'Temporal context could not be inferred.',
    educationalInsights: fallbackInsight,
  };
}

// Gemini-based comprehensive video understanding
async function geminiVideoUnderstanding(videoData: string, mimeType?: string): Promise<GeminiVideoUnderstanding> {
  const prompt = `Analyze this video comprehensively for misinformation detection and return STRICT JSON only.

Return JSON with the following shape:
{
  "contentDescription": string,
  "technicalAssessment": object | string,
  "contextualInfo": {
    "recognizedText": string[],
    "brands": string[],
    "logos": string[],
    "locations": string[]
  },
  "authenticityScore": number, // 0-100 where higher = more likely authentic
  "potentialIssues": string[],
  "recommendedFactChecks": string[],
  "transcription": string,
  "events": string[]
}

Guidelines:
- Be specific and rely on visible/audio evidence.
- Include short transcript if possible.
- Identify any editing/manipulation indicators in technicalAssessment.
- If uncertain, provide best-effort analysis with clear caveats.`;

  try {
    const filePart = buildVideoPart(videoData, mimeType);
    const result = await generativeVisionModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            filePart as any,
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
    });
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    if (parsed && typeof parsed === 'object') {
      return {
        contentDescription: String(parsed.contentDescription || ''),
        technicalAssessment: parsed.technicalAssessment ?? {},
        contextualInfo: {
          recognizedText: Array.isArray(parsed?.contextualInfo?.recognizedText) ? parsed.contextualInfo.recognizedText : [],
          brands: Array.isArray(parsed?.contextualInfo?.brands) ? parsed.contextualInfo.brands : [],
          logos: Array.isArray(parsed?.contextualInfo?.logos) ? parsed.contextualInfo.logos : [],
          locations: Array.isArray(parsed?.contextualInfo?.locations) ? parsed.contextualInfo.locations : [],
        },
        authenticityScore: Number.isFinite(parsed.authenticityScore) ? Math.max(0, Math.min(100, Number(parsed.authenticityScore))) : 50,
        potentialIssues: Array.isArray(parsed.potentialIssues) ? parsed.potentialIssues : [],
        recommendedFactChecks: Array.isArray(parsed.recommendedFactChecks) ? parsed.recommendedFactChecks : [],
        transcription: String(parsed.transcription || ''),
        events: Array.isArray(parsed.events) ? parsed.events.map((e: any) => String(e)) : [],
      };
    }
  } catch (e) {
    console.warn('[WARN] Gemini video understanding failed:', e);
  }

  // Fallback if model call or parsing fails
  return {
    contentDescription: 'Video content analysis unavailable',
    technicalAssessment: {},
    contextualInfo: { recognizedText: [], brands: [], logos: [], locations: [] },
    authenticityScore: 50,
    potentialIssues: [],
    recommendedFactChecks: [],
    transcription: '',
    events: [],
  };
}

// VI shot change detection to derive representative timestamps (no frame extraction)
async function getShotChangeTimestamps(videoData: string): Promise<Array<{ startSec: number; endSec: number }>> {
  const client = new videoIntelligence.VideoIntelligenceServiceClient();
  const request = {
    inputUri: videoData.startsWith('gs://') ? videoData : undefined,
    inputContent: videoData.startsWith('data:') ? Buffer.from(videoData.split(',')[1], 'base64') : undefined,
    features: [viProtos.google.cloud.videointelligence.v1.Feature.SHOT_CHANGE_DETECTION],
  } as any;
  try {
    const [operation] = await client.annotateVideo(request);
    const [result] = await operation.promise();
    const shots = result.annotationResults?.[0]?.shotAnnotations || [];
    return shots.slice(0, 10).map((s: any) => {
      const start = Number(s.startTimeOffset?.seconds || 0) + Number(s.startTimeOffset?.nanos || 0) / 1e9;
      const end = Number(s.endTimeOffset?.seconds || 0) + Number(s.endTimeOffset?.nanos || 0) / 1e9;
      return { startSec: Math.max(0, Math.floor(start)), endSec: Math.max(0, Math.ceil(end)) };
    });
  } catch (e) {
    console.warn('[WARN] Shot change detection failed:', e);
    return [];
  }
}

// Build targeted search queries from understanding + transcription
function buildSearchQueries(
  understanding: GeminiVideoUnderstanding,
  transcription: string
): string[] {
  const queries = new Set<string>();
  
  // Add contextual info
  [...(understanding?.contextualInfo?.recognizedText || []).slice(0, 2),
   ...(understanding?.contextualInfo?.brands || []).slice(0, 2),
   ...(understanding?.contextualInfo?.locations || []).slice(0, 2),
   ...(understanding?.events || []).slice(0, 2)]
    .filter(Boolean)
    .forEach(item => queries.add(item));

  // Add transcription and description snippets
  if (transcription) queries.add(transcription.slice(0, 100));
  if (understanding?.contentDescription) queries.add(understanding.contentDescription.slice(0, 100));

  return Array.from(queries).slice(0, 4);
}

// Perform web searches and deduplicate results
async function performWebSearches(
  queries: string[],
  searchEngineId?: string
): Promise<Array<{ title: string; url: string; snippet: string; date: string; relevance: number }>> {
  const results = await Promise.allSettled(
    queries.map(q => performWebAnalysis({ query: q, contentType: 'text', mediaType: 'video', searchEngineId }))
  );
  
  const byUrl = new Map<string, { title: string; url: string; snippet: string; date: string; relevance: number }>();
  results.forEach(result => {
    if (result.status === 'fulfilled' && Array.isArray(result.value?.currentInformation)) {
      result.value.currentInformation.forEach((item: any) => {
        if (item?.url && !byUrl.has(item.url)) {
          byUrl.set(item.url, {
            title: item.title || 'Untitled',
            url: item.url,
            snippet: item.snippet || '',
            date: item.date || '',
            relevance: item.relevance || 0.5
          });
        }
      });
    }
  });
  
  return Array.from(byUrl.values())
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10);
}
// Helper to fact-check video content
async function analyzeVideoContentAndFactCheck(
  videoData: string,
  transcription: string
): Promise<{ factualClaims: Array<{ claim: string; verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED'; confidence: number; }> }> {
  const prompt = transcription 
    ? `Fact-check the content of this video, including transcribed audio: "${transcription}". List factual claims with verdict (VERIFIED, DISPUTED, UNVERIFIED) and confidence (0-1).` 
    : `Fact-check the content of this video. List factual claims with verdict (VERIFIED, DISPUTED, UNVERIFIED) and confidence (0-1).`;
  
  const result = await groundedModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1 },
  });
  
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const claimsRegex = /Claim: "(.*?)"\s*Verdict: (VERIFIED|DISPUTED|UNVERIFIED)\s*Confidence: (\d\.\d+)/g;
  const factualClaims: Array<{ claim: string; verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED'; confidence: number; }> = [];
  let match;
  while ((match = claimsRegex.exec(responseText)) !== null) {
    factualClaims.push({
      claim: match[1],
      verdict: match[2] as 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED',
      confidence: parseFloat(match[3]),
    });
  }

  return { factualClaims };
}

// Helper for deepfake detection using Gemini vision with structured JSON
async function detectVideoDeepfake(videoData: string, mimeType?: string) {
  const prompt = `You are a media forensics expert. Analyze the provided video and return STRICT JSON only with this shape:
{
  "isManipulated": boolean,
  "confidence": number, // 0-1
  "explanation": string
}
Guidance:
- Consider frame consistency, lighting/shadows, lip-sync, compression artifacts, motion blur, and edge halos.
- If unsure, set isManipulated to false and confidence around 0.5 with explanation.`;

  try {
    const filePart = buildVideoPart(videoData, mimeType);
    const result = await generativeVisionModel.generateContent({
      contents: [{
        role: 'user',
        parts: [ { text: prompt }, filePart as any ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
    });
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    if (parsed && typeof parsed === 'object') {
      return {
        isManipulated: Boolean(parsed.isManipulated),
        confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : 0.5,
        explanation: String(parsed.explanation || '').trim() || 'Analysis not conclusive.',
      };
    }
  } catch (e) {
    console.warn('[WARN] Gemini deepfake analysis failed; falling back to heuristic parse', e);
  }

  // Last-resort heuristic fallback on free-form text (rare)
  const fallback = await groundedModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Is this video manipulated? Return: Manipulated: true/false, Confidence: 0.0-1.0, Explanation: ...' }] }],
    generationConfig: { temperature: 0.1 },
  });
  const responseText = fallback.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const conf = /Confidence:\s*(\d\.\d+)/.exec(responseText)?.[1];
  return {
    isManipulated: /Manipulated:\s*true/i.test(responseText),
    confidence: conf ? Math.max(0, Math.min(1, parseFloat(conf))) : 0.5,
    explanation: responseText.split('Explanation:')[1]?.trim() || 'Analysis not conclusive.',
  };
}

// Helper to calculate scores
function calculateScores(contentAnalysis: any, manipulationAnalysis: { isManipulated: boolean; confidence: number }): {
  sourceIntegrityScore: number;
  contentAuthenticityScore: number;
  trustExplainabilityScore: number;
} {
  const verifiedClaims = contentAnalysis.factualClaims.filter((c: any) => c.verdict === 'VERIFIED').length;
  const totalClaims = Math.max(1, contentAnalysis.factualClaims.length);
  const disputedClaims = contentAnalysis.factualClaims.filter((c: any) => c.verdict === 'DISPUTED').length;
  
  // Source Integrity Score
  const verificationRate = verifiedClaims / totalClaims;
  const sourceIntegrityScore = Math.round(verificationRate * 100);
  
  // Content Authenticity Score
  const baseAuthenticity = manipulationAnalysis.isManipulated ? 20 : 80;
  const confidenceBoost = manipulationAnalysis.confidence * 20;
  const disputePenalty = (disputedClaims / totalClaims) * 30;
  const contentAuthenticityScore = Math.round(Math.max(0, baseAuthenticity + confidenceBoost - disputePenalty));
  
  // Trust Explainability Score
  const avgConfidence = contentAnalysis.factualClaims.reduce((sum: number, c: any) => sum + c.confidence, 0) / totalClaims;
  const trustExplainabilityScore = Math.round(
    (sourceIntegrityScore * 0.3 + contentAuthenticityScore * 0.4 + avgConfidence * 100 * 0.3)
  );
  
  return {
    sourceIntegrityScore: Math.min(100, sourceIntegrityScore),
    contentAuthenticityScore: Math.min(100, contentAuthenticityScore),
    trustExplainabilityScore: Math.min(100, trustExplainabilityScore),
  };
}

// Main analysis function
export async function analyzeVideoContent(input: VideoAnalysisInput, options?: { searchEngineId?: string }): Promise<VideoAnalysisOutput> {
  // Generate cache key from video data and options
  const cacheKey = `${input.videoData.substring(0, 100)}_${input.mimeType || ''}_${options?.searchEngineId || ''}`;
  
  // Check cache first
  const cached = analysisCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.result;
  }

  try {
    // Run core analysis operations in parallel
    const [intelligenceAnalysis, understanding, deepfakeInfo] = await Promise.all([
      analyzeVideoIntelligence(input.videoData),
      geminiVideoUnderstanding(input.videoData, input.mimeType),
      detectDeepfake({ media: input.videoData, contentType: 'video' })
        .then(r => ({ isManipulated: r.isDeepfake, manipulationConfidence: r.confidenceScore / 100 }))
        .catch(() => detectVideoDeepfake(input.videoData, input.mimeType)
          .then(r => ({ isManipulated: r.isManipulated, manipulationConfidence: r.confidence })))
    ]);

    // Early exit if critical data is missing
    if (!intelligenceAnalysis?.transcription) {
      throw new Error('Could not process video content: No transcription available');
    }

    const metadata = {
      location: intelligenceAnalysis.location,
      transcription: intelligenceAnalysis.transcription,
      events: intelligenceAnalysis.events,
      isManipulated: deepfakeInfo.isManipulated,
      technicalData: intelligenceAnalysis.technicalData,
    };

    // Run fact-checking and web analysis in parallel
    const [contentAnalysis, webAnalysis] = await Promise.all([
      analyzeVideoContentAndFactCheck(input.videoData, intelligenceAnalysis.transcription)
        .catch(() => ({ factualClaims: [] })),
      performWebAnalysis({
        query: intelligenceAnalysis.transcription.substring(0, 500),
        contentType: 'text',
        mediaType: 'video',
        searchEngineId: options?.searchEngineId
      }).catch(() => ({ currentInformation: [] }))
    ]);

    const isManipulated = deepfakeInfo.isManipulated;
    const manipulationConfidence = deepfakeInfo.manipulationConfidence;

    // Build targeted search queries and perform web searches
    const [guidedQueries, searchQueries] = await Promise.all([
      buildGeminiGuidedSearchQueries(understanding, intelligenceAnalysis.transcription).catch(() => []),
      Promise.resolve(buildSearchQueries(understanding, intelligenceAnalysis.transcription))
    ]);
    
    const allQueries = Array.from(new Set([...guidedQueries, ...searchQueries]));
    const webSources = allQueries.length > 0
      ? await performWebSearches(allQueries, options?.searchEngineId)
      : [];

    // Combine with direct web analysis results
    const directSources = webAnalysis.currentInformation || [];
    const uniqueSources = Array.from(
      new Map([...directSources, ...webSources]
        .filter(s => s?.url)
        .map(s => [s.url, {
          url: s.url,
          title: s.title || 'Untitled Source',
          snippet: s.snippet || '',
          relevance: s.relevance || 0.5
        }])
      ).values()
    )
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 8); // Top 8 most relevant sources

    // Step 6: Determine analysis label
    let analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN' = 'YELLOW';
    const verifiedClaims = contentAnalysis.factualClaims.filter((c: any) => c.verdict === 'VERIFIED').length;
    const disputedClaims = contentAnalysis.factualClaims.filter((c: any) => c.verdict === 'DISPUTED').length;
    const totalClaims = Math.max(1, contentAnalysis.factualClaims.length);

    if (isManipulated && manipulationConfidence > 0.7) {
      analysisLabel = 'RED';
    } else if (verifiedClaims === totalClaims && !isManipulated) {
      analysisLabel = 'GREEN';
    } else if (disputedClaims > 0 || (isManipulated && manipulationConfidence > 0.5)) {
      analysisLabel = 'ORANGE';
    }

    // Calculate scores and prepare for presentation
    const scores = calculateScores(contentAnalysis, { isManipulated, confidence: manipulationConfidence });
    
    // Prepare candidate sources with fallbacks
    const candidateSources = uniqueSources.map((s: any) => ({
      url: s.url || '',
      title: s.title || 'Untitled Source',
      snippet: s.snippet || '',
      relevance: s.relevance || 0.5
    }));
    const presentation = await formatUnifiedPresentation({
      contentType: 'video',
      analysisLabel,
      rawSignals: {
        transcription: intelligenceAnalysis.transcription,
        events: intelligenceAnalysis.events,
        factualClaims: contentAnalysis.factualClaims,
        isManipulated,
        manipulationConfidence,
        metadata,
        geminiUnderstanding: understanding,
      },
      candidateSources
    });

    const deepAnalysis = await generateDeepAnalysisNarrative({
      transcription: intelligenceAnalysis.transcription,
      events: intelligenceAnalysis.events,
      understanding,
      analysisLabel,
      existingEducationalInsight: presentation.educationalInsight,
      sources: (presentation.sources || []).map((source: any) => ({
        url: source.url,
        title: source.title,
      })),
    });

    // Prepare the result
    const result: VideoAnalysisOutput = {
      analysisLabel,
      oneLineDescription: presentation.oneLineDescription || 'Video analysis completed',
      summary: presentation.summary || 'No summary available',
      educationalInsight: presentation.educationalInsight || 'No educational insight available',
      sources: (presentation.sources || []).map((s: any) => ({
        url: s.url || '',
        title: s.title || 'Untitled Source',
        credibility: s.credibility || 0.5
      })),
      sourceIntegrityScore: scores.sourceIntegrityScore,
      contentAuthenticityScore: scores.contentAuthenticityScore,
      trustExplainabilityScore: scores.trustExplainabilityScore,
      metadata: {
        location: metadata.location,
        transcription: metadata.transcription,
        events: metadata.events || [],
        isManipulated: metadata.isManipulated || false,
        technicalData: metadata.technicalData || {}
      },
      deepAnalysis: deepAnalysis || {
        what: 'Analysis incomplete',
        how: 'Not available',
        why: 'Not available',
        when: 'Not available',
        educationalInsights: ['Analysis could not be completed']
      }
    };

    // Cache the result
    analysisCache.set(cacheKey, {
      timestamp: Date.now(),
      result
    });

    return result;
  } catch (error) {
    console.error('Error in video analysis:', error);
    
    // Return error response with proper format
    return {
      analysisLabel: 'RED',
      oneLineDescription: 'Video analysis encountered an error',
      summary: 'The video analysis could not be completed due to technical issues. Please verify the video format and try again.',
      educationalInsight: 'When video analysis fails, use manual verification methods like checking the source, looking for visual inconsistencies, and using alternative deepfake detection tools.',
      sources: [
        { 
          url: 'https://deepware.ai/', 
          title: 'Deepware AI Detection', 
          credibility: 0.88 
        }
      ],
      sourceIntegrityScore: 0,
      contentAuthenticityScore: 0,
      trustExplainabilityScore: 0,
      metadata: {},
      deepAnalysis: {
        what: 'Video analysis unavailable due to an internal error.',
        how: 'Technical processing steps failed before a narrative could be assembled.',
        why: 'The system could not determine the motivation or implications without successful analysis.',
        when: 'Temporal cues were not extracted.',
        educationalInsights: [
          'Retry the analysis later and corroborate information with trusted educational resources.'
        ],
      }
    };
  }
}
