import { z } from 'zod';
import { performWebAnalysis } from './perform-web-analysis.js';
import { detectDeepfake } from './detect-deepfake.js';
import { groundedModel, generativeModel, generativeVisionModel } from '../genkit.js';

const ImageAnalysisInputSchema = z.object({
  imageData: z.string().min(1, 'Image data is required'), // Base64 or URL
  mimeType: z.string().optional(),
});
export type ImageAnalysisInput = z.infer<typeof ImageAnalysisInputSchema>;

const ImageAnalysisOutputSchema = z.object({
  // 1. Analysis Label (risk level)
  analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']).describe('Risk level of the content'),

  // 2. One-line description (AI polished)
  oneLineDescription: z.string().describe('Brief AI-polished description of the image'),

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
    ocrText: z.string().optional(),
    description: z.string().optional(),
    isManipulated: z.boolean().optional(),
    understandingDescription: z.string().optional(),
  }).optional(),
  deepAnalysis: z.object({
    what: z.string(),
    how: z.string(),
    why: z.string(),
    when: z.string(),
    educationalInsights: z.array(z.string()),
  }).optional(),
});
export type ImageAnalysisOutput = z.infer<typeof ImageAnalysisOutputSchema>;

function buildImagePart(imageData: string, mimeType?: string): any {
  if (imageData.startsWith('data:')) {
    const commaIdx = imageData.indexOf(',');
    const header = imageData.substring(5, commaIdx); // e.g., image/png;base64
    const derivedMime = header.split(';')[0] || 'image/png';
    const base64Data = imageData.substring(commaIdx + 1);
    return {
      inlineData: {
        mimeType: mimeType || derivedMime || 'image/png',
        data: base64Data,
      },
    };
  }
  if (imageData.startsWith('http://') || imageData.startsWith('https://') || imageData.startsWith('gs://')) {
    return {
      fileData: {
        fileUri: imageData,
        mimeType: mimeType || 'image/png',
      },
    };
  }
  return {
    inlineData: {
      mimeType: mimeType || 'image/png',
      data: imageData,
    },
  };
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

type GeminiImageUnderstanding = {
  description: string;
  detectedObjects: string[];
  recognizedText: string[];
  locations: string[];
  authenticityScore: number;
  potentialIssues: string[];
  recommendedFactChecks: string[];
};

type ImageDeepAnalysisNarrative = {
  what: string;
  how: string;
  why: string;
  when: string;
  educationalInsights: string[];
};

type ReverseImageSource = {
  url: string;
  title?: string;
  score?: number;
  snippet?: string;
  date?: string;
  relevance?: number;
};

type ExtractedImageSignals = {
  location: string;
  safeSearch?: {
    adult?: string;
    spoof?: string;
    medical?: string;
    violence?: string;
    racy?: string;
  };
  logos: Array<{ description: string; score?: number }>;
  labels: Array<{ description: string; score?: number }>;
  webDetection: {
    bestGuessLabels: string[];
    webEntities: Array<{ description: string; score?: number }>;
  };
  watermarkFindings: {
    hasWatermark: boolean;
    confidence: number;
    indicators: string[];
  };
  suspectedAIGenerated: boolean;
  aiIndicators: string[];
  possibleSources: ReverseImageSource[];
};

type VertexTextInsights = {
  summary: string;
  rawClaims: Array<{
    claim: string;
    verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED';
    confidence: number;
  }>;
  riskIndicators: string[];
};

type VertexImageInsights = {
  reverseSearchHints: string[];
  watermarkIndicators: string[];
  aiIndicators: string[];
  suspectedAIGenerated?: boolean;
  aiConfidence?: number;
  hasWatermark?: boolean;
  watermarkConfidence?: number;
};

const LIKELIHOOD_VALUES = [
  'UNKNOWN',
  'VERY_UNLIKELY',
  'UNLIKELY',
  'POSSIBLE',
  'LIKELY',
  'VERY_LIKELY',
];

function likelihoodToString(likelihood?: number | string | null): string | undefined {
  if (likelihood === undefined || likelihood === null) return undefined;
  if (typeof likelihood === 'string') return likelihood;
  return LIKELIHOOD_VALUES[likelihood] ?? 'UNKNOWN';
}

const WATERMARK_TERMS = [
  /watermark/i,
  /getty/i,
  /alamy/i,
  /stock photo/i,
  /shutterstock/i,
  /istock/i,
  /adobestock/i,
  /depositphotos/i,
];

const AI_INDICATOR_TERMS = [
  /ai[-\s]?generated/i,
  /midjourney/i,
  /stable diffusion/i,
  /dall[-\s]?e/i,
  /deepfake/i,
  /synthetic media/i,
  /gan[-\s]?generated/i,
  /diffusion model/i,
];

function toVisionImagePayload(imageData: string) {
  if (!imageData) {
    return {};
  }
  if (imageData.startsWith('data:')) {
    const [, base64Data = ''] = imageData.split(',');
    return { content: base64Data };
  }
  if (imageData.startsWith('http://') || imageData.startsWith('https://') || imageData.startsWith('gs://')) {
    return { source: { imageUri: imageData } };
  }
  return { content: imageData };
}

async function geminiImageUnderstanding(imageData: string, mimeType?: string): Promise<GeminiImageUnderstanding> {
  const prompt = `Analyze the provided image strictly for misinformation-related context. Return STRICT JSON only with this shape:
{
  "description": string,
  "detectedObjects": string[],
  "recognizedText": string[],
  "locations": string[],
  "authenticityScore": number,
  "potentialIssues": string[],
  "recommendedFactChecks": string[]
}

Guidelines:
- Mention notable objects and symbols.
- Include recognized text (short strings) if visible.
- State location clues if present.
- authenticityScore: 0-100, higher means more likely authentic.
- Flag potential manipulation indicators.`;

  try {
    const filePart = buildImagePart(imageData, mimeType);
    const result = await generativeVisionModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }, filePart as any],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    });
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    if (parsed && typeof parsed === 'object') {
      return {
        description: String(parsed.description || ''),
        detectedObjects: Array.isArray(parsed.detectedObjects) ? parsed.detectedObjects.map((v: any) => String(v)) : [],
        recognizedText: Array.isArray(parsed.recognizedText) ? parsed.recognizedText.map((v: any) => String(v)) : [],
        locations: Array.isArray(parsed.locations) ? parsed.locations.map((v: any) => String(v)) : [],
        authenticityScore: Number.isFinite(parsed.authenticityScore) ? Math.max(0, Math.min(100, Number(parsed.authenticityScore))) : 50,
        potentialIssues: Array.isArray(parsed.potentialIssues) ? parsed.potentialIssues.map((v: any) => String(v)) : [],
        recommendedFactChecks: Array.isArray(parsed.recommendedFactChecks) ? parsed.recommendedFactChecks.map((v: any) => String(v)) : [],
      };
    }
  } catch (error) {
    console.warn('[WARN] Gemini image understanding failed:', error);
  }

  return {
    description: 'Image understanding unavailable',
    detectedObjects: [],
    recognizedText: [],
    locations: [],
    authenticityScore: 50,
    potentialIssues: [],
    recommendedFactChecks: [],
  };
}

async function buildGeminiGuidedSearchQueries(
  understanding: GeminiImageUnderstanding,
  ocrText: string
): Promise<string[]> {
  try {
    const prompt = `You assist with reverse image intelligence. Based on this structured context, propose up to five precise search queries (strict JSON).

Context:
${JSON.stringify({
      description: understanding?.description || '',
      objects: understanding?.detectedObjects || [],
      recognizedText: understanding?.recognizedText || [],
      locations: understanding?.locations || [],
      potentialIssues: understanding?.potentialIssues || [],
      ocrText,
    })}

Return format:
{
  "queries": ["..."],
  "notes": "short rationale"
}`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    const queriesCandidate = Array.isArray(parsed?.queries) ? parsed.queries : parsed;
    if (Array.isArray(queriesCandidate)) {
      return queriesCandidate
        .map((q) => (typeof q === 'string' ? q.trim() : ''))
        .filter((q) => q.length > 0)
        .slice(0, 5);
    }
  } catch (error) {
    console.warn('[WARN] Gemini-guided image search generation failed:', error);
  }
  return [];
}

function buildReverseImageQueries(
  understanding: GeminiImageUnderstanding,
  ocrText: string
): string[] {
  const queries: string[] = [];
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > 0) queries.push(trimmed);
  };

  understanding.detectedObjects?.slice(0, 4).forEach((obj) => add(`${obj} authenticity check`));
  understanding.recognizedText?.slice(0, 3).forEach((text) => add(text));
  understanding.locations?.slice(0, 2).forEach((loc) => add(`${loc} news verification`));
  understanding.potentialIssues?.slice(0, 2).forEach((issue) => add(`${issue} fact check`));

  if (understanding.description) {
    add(understanding.description.slice(0, 120));
  }
  if (ocrText) {
    add(ocrText.slice(0, 120));
  }

  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = q.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

async function reverseImageGrounding(
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
      console.warn('[WARN] reverseImageGrounding query failed:', q, error);
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
  understanding: GeminiImageUnderstanding;
  ocrText: string;
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  existingEducationalInsight?: string;
  sources: Array<{ url: string; title: string }>;
}): Promise<ImageDeepAnalysisNarrative> {
  try {
    const prompt = `You extend an image misinformation report with educational framing. Using the structured context below, output STRICT JSON with:
{
  "what": "What the image appears to show",
  "how": "How the image may have been produced or manipulated",
  "why": "Why the image exists or matters",
  "when": "Temporal or situational clues",
  "educationalInsights": ["Actionable media literacy tips"]
}

Context:
${JSON.stringify({
      understanding: params.understanding,
      ocrText: params.ocrText,
      analysisLabel: params.analysisLabel,
      sources: params.sources,
      existingEducationalInsight: params.existingEducationalInsight,
    })}`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    if (parsed && typeof parsed === 'object') {
      const narrative: ImageDeepAnalysisNarrative = {
        what: String(parsed.what || '').trim() || 'Detailed description unavailable.',
        how: String(parsed.how || '').trim() || 'Potential manipulation technique could not be determined.',
        why: String(parsed.why || '').trim() || 'Motivation or impact remains unclear.',
        when: String(parsed.when || '').trim() || 'Temporal context could not be inferred.',
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
    console.warn('[WARN] Gemini image deep analysis narrative failed:', error);
  }

  const fallbackInsight = params.existingEducationalInsight
    ? [params.existingEducationalInsight]
    : ['Use reverse image search and look for trustworthy reporting before sharing.'];

  return {
    what: 'Detailed description unavailable due to limited context.',
    how: 'Potential manipulation signs could not be identified.',
    why: 'Motivation or impact of this image remains unclear.',
    when: 'Temporal information could not be determined.',
    educationalInsights: fallbackInsight,
  };
}

async function analyzeImageTextWithVertex(ocrText: string): Promise<VertexTextInsights | null> {
  const trimmed = ocrText?.trim();
  if (!trimmed) {
    return null;
  }

  const prompt = `You are an investigative fact-checking assistant. Given text extracted from an image, produce strict JSON with this structure:
{
  "summary": string,
  "rawClaims": [
    { "claim": string, "verdict": "VERIFIED"|"DISPUTED"|"UNVERIFIED", "confidence": number }
  ],
  "riskIndicators": string[]
}

Text to analyze:
"""
${trimmed.slice(0, 4000)}
"""

Rules:
- Use only the allowed verdict values.
- confidence must be 0-1.
- Return JSON only (no prose).`;

  try {
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    });
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    if (parsed && typeof parsed === 'object') {
      const summary = typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : trimmed.slice(0, 200);

      const rawClaimsInput = Array.isArray(parsed.rawClaims)
        ? parsed.rawClaims
        : Array.isArray(parsed.claims)
          ? parsed.claims
          : [];

      const normalizeVerdict = (value: unknown): 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED' => {
        const upper = String(value || '').toUpperCase();
        return upper === 'VERIFIED' || upper === 'DISPUTED' ? (upper as any) : 'UNVERIFIED';
      };

      const rawClaims = rawClaimsInput
        .map((item: Record<string, unknown>) => ({
          claim: String(item?.claim ?? item?.statement ?? '').trim(),
          verdict: normalizeVerdict(item?.verdict),
          confidence: Math.max(0, Math.min(1, typeof item?.confidence === 'number' ? item.confidence : Number(item?.confidence ?? 0.5))),
        }))
        .filter((entry: any): entry is {
          claim: string;
          verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED';
          confidence: number;
        } => entry.claim.length > 10)
        .slice(0, 5);

      const riskIndicators = Array.isArray(parsed.riskIndicators)
        ? parsed.riskIndicators.map((indicator: any) => String(indicator || '').trim()).filter(Boolean)
        : [];

      return {
        summary,
        rawClaims,
        riskIndicators,
      };
    }
  } catch (error) {
    console.warn('[WARN] Image text insight generation failed:', error);
  }

  const fallbackClaims = trimmed
    .split(/(?<=[\.\!\?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20)
    .slice(0, 3)
    .map((sentence) => ({ claim: sentence, verdict: 'UNVERIFIED' as const, confidence: 0.4 }));

  return {
    summary: trimmed.slice(0, 200),
    rawClaims: fallbackClaims,
    riskIndicators: [],
  };
}

// Helper to extract image metadata using Gemini Vision API (prototype mode)
async function extractImageMetadata(imageData: string): Promise<ExtractedImageSignals> {
  console.log('[INFO] PROTOTYPE MODE - Using Gemini Vision API for metadata extraction');
  
  try {
    // Use Gemini Vision model for metadata extraction
    const result = await generativeVisionModel.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { 
            text: `Analyze this image and extract metadata information. Provide a JSON response with the following structure:
{
  "location": "estimated location or landmark name or 'Unknown'",
  "safeSearch": {
    "adult": "VERY_UNLIKELY|UNLIKELY|POSSIBLE|LIKELY|VERY_LIKELY",
    "spoof": "VERY_UNLIKELY|UNLIKELY|POSSIBLE|LIKELY|VERY_LIKELY", 
    "medical": "VERY_UNLIKELY|UNLIKELY|POSSIBLE|LIKELY|VERY_LIKELY",
    "violence": "VERY_UNLIKELY|UNLIKELY|POSSIBLE|LIKELY|VERY_LIKELY",
    "racy": "VERY_UNLIKELY|UNLIKELY|POSSIBLE|LIKELY|VERY_LIKELY"
  },
  "logos": [{"description": "logo name", "score": 0.0-1.0}],
  "labels": [{"description": "object/concept", "score": 0.0-1.0}],
  "webDetection": {
    "bestGuessLabels": ["label1", "label2"],
    "webEntities": [{"description": "entity", "score": 0.0-1.0}]
  },
  "suspectedAIGenerated": boolean,
  "aiIndicators": ["ai", "indicators"],
  "watermarkFindings": {
    "hasWatermark": boolean,
    "confidence": 0.0-1.0,
    "indicators": ["watermark", "indicators"]
  },
  "possibleSources": [{"url": "source_url", "title": "title", "score": 0.0-1.0}]
}

Analyze the image for content, safety, logos, objects, potential AI generation signs, watermarks, and possible sources.` 
          },
          { inlineData: { mimeType: imageData.split(';')[0].split(':')[1] || 'image/jpeg', data: imageData.split(';base64,')[1] } }
        ]
      }]
    });
    
    const response = await result.response;
    const analysisText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Try to parse JSON response
    let parsed;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('[WARN] Failed to parse Gemini metadata JSON, using defaults');
    }
    
    const signals: ExtractedImageSignals = {
      location: parsed?.location || 'Unknown',
      safeSearch: parsed?.safeSearch || undefined,
      logos: parsed?.logos || [],
      labels: parsed?.labels || [],
      webDetection: parsed?.webDetection || { bestGuessLabels: [], webEntities: [] },
      watermarkFindings: {
        hasWatermark: parsed?.watermarkFindings?.hasWatermark || false,
        confidence: parsed?.watermarkFindings?.confidence || 0,
        indicators: parsed?.watermarkFindings?.indicators || []
      },
      suspectedAIGenerated: parsed?.suspectedAIGenerated || false,
      aiIndicators: parsed?.aiIndicators || [],
      possibleSources: parsed?.possibleSources || []
    };
    
    return signals;
  } catch (error) {
    console.error('Gemini Vision API error:', error);
    return {
      location: 'Unknown',
      safeSearch: undefined,
      logos: [],
      labels: [],
      webDetection: { bestGuessLabels: [], webEntities: [] },
      watermarkFindings: { hasWatermark: false, confidence: 0, indicators: [] },
      suspectedAIGenerated: false,
      aiIndicators: [],
      possibleSources: [],
    } as ExtractedImageSignals;
  }
}

// Helper to perform OCR on image using Gemini Vision API (prototype mode)
async function performOcr(imageData: string) {
  console.log('[INFO] PROTOTYPE MODE - Using Gemini Vision API for OCR');
  
  try {
    // Use Gemini Vision model for OCR
    const result = await generativeVisionModel.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { 
            text: 'Extract all readable text from this image. Return only the text content, preserving line breaks and formatting where possible. If no text is visible, return an empty string.' 
          },
          { inlineData: { mimeType: imageData.split(';')[0].split(':')[1] || 'image/jpeg', data: imageData.split(';base64,')[1] } }
        ]
      }]
    });
    
    const response = await result.response;
    const extractedText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return extractedText || '';
  } catch (error) {
    console.error('Gemini OCR error:', error);
    return '';
  }
}

function deriveReverseImageQueries({
  metadata,
  ocrText,
  vertexInsights,
}: {
  metadata: ExtractedImageSignals;
  ocrText: string;
  vertexInsights?: VertexImageInsights | null;
}): string[] {
  const queries = new Set<string>();

  const addQuery = (raw: string | undefined) => {
    if (!raw) return;
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 4) return;
    queries.add(cleaned.slice(0, 200));
  };

  if (ocrText) {
    const lines = ocrText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    addQuery(lines.slice(0, 2).join(' '));
    if (lines.length > 2) {
      addQuery(lines.slice(0, 3).join(' '));
    }
    addQuery(ocrText.slice(0, 180));
  }

  metadata.webDetection.bestGuessLabels.forEach((label) => addQuery(label));
  metadata.aiIndicators.forEach((indicator) => addQuery(indicator));
  metadata.watermarkFindings.indicators.forEach((indicator) => addQuery(indicator));
  metadata.logos.slice(0, 3).forEach((logo) => addQuery(logo.description));
  metadata.labels.slice(0, 3).forEach((label) => addQuery(label.description));
  if (metadata.location && metadata.location !== 'Unknown') {
    addQuery(`${metadata.location} image`);
  }

  if (vertexInsights) {
    vertexInsights.reverseSearchHints.forEach((hint) => addQuery(hint));
    vertexInsights.watermarkIndicators.forEach((indicator) => addQuery(indicator));
    vertexInsights.aiIndicators.forEach((indicator) => addQuery(indicator));
    if (vertexInsights.suspectedAIGenerated && (vertexInsights.aiConfidence ?? 0) >= 0.6) {
      addQuery('AI generated image verification');
    }
  }

  const queriesArray = Array.from(queries).filter((query) => query.length >= 4);
  if (queriesArray.length === 0) {
    queriesArray.push('reverse image search authenticity verification');
  }
  return queriesArray;
}

// Helper to analyze image content and extract claims from OCR (heuristic; no LLM)
async function analyzeImageContentAndFactCheck(
  imageData: string,
  ocrText: string
): Promise<{ description: string; factualClaims: Array<{ claim: string; verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED'; confidence: number; }>; vertexTextInsights?: VertexTextInsights | null; }> {
  const vertexTextInsights = await analyzeImageTextWithVertex(ocrText);

  const baseDescription = ocrText
    ? `Image with readable text (~${Math.min(ocrText.length, 500)} chars).`
    : 'Image content analyzed (no readable text detected).';

  const description = vertexTextInsights?.summary
    ? `Image text summary: ${vertexTextInsights.summary}`
    : baseDescription;

  const heuristicExtractClaims = (): Array<{ claim: string; verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED'; confidence: number; }> => {
    const sentences = (ocrText || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[\.\!\?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const factualRegex = /(\bis\b|\bare\b|\bwas\b|\bwere\b|\bhas\b|\bhave\b|\bclaims?\b|\breports?\b|\baccording to\b|\bpercent|\b\d{4}\b)/i;
    const candidateClaims = Array.from(new Set(sentences.filter((s) => s.length > 20 && factualRegex.test(s)))).slice(0, 5);
    return candidateClaims.map((claim) => ({ claim, verdict: 'UNVERIFIED', confidence: 0.4 }));
  };

  const factualClaims = vertexTextInsights?.rawClaims?.length
    ? vertexTextInsights.rawClaims
    : heuristicExtractClaims();

  return { description, factualClaims, vertexTextInsights };
}

async function getVertexImageInsights(imageData: string, mimeType?: string): Promise<VertexImageInsights | null> {
  try {
    const prompt = `You provide supplemental authenticity signals for an image. Return strict JSON with fields:
{
  "reverseSearchHints": string[],
  "watermarkIndicators": string[],
  "aiIndicators": string[],
  "suspectedAIGenerated": boolean,
  "aiConfidence": number,
  "hasWatermark": boolean,
  "watermarkConfidence": number
}
- Arrays must contain short descriptive phrases (<=80 characters).
- Confidence numbers must be 0-1.
- Respond with JSON only.`;

    const filePart = buildImagePart(imageData, mimeType);
    const result = await generativeVisionModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }, filePart as any],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    });

    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    if (parsed && typeof parsed === 'object') {
      const normalizeArray = (value: unknown) =>
        Array.isArray(value)
          ? value.map((entry: unknown) => String(entry || '').trim()).filter(Boolean).slice(0, 10)
          : [];

      const clamp = (num: unknown) => {
        const parsedNumber = typeof num === 'number' ? num : Number(num ?? 0);
        return Math.max(0, Math.min(1, Number.isFinite(parsedNumber) ? parsedNumber : 0));
      };

      return {
        reverseSearchHints: normalizeArray(parsed.reverseSearchHints),
        watermarkIndicators: normalizeArray(parsed.watermarkIndicators),
        aiIndicators: normalizeArray(parsed.aiIndicators),
        suspectedAIGenerated: Boolean(parsed.suspectedAIGenerated),
        aiConfidence: clamp(parsed.aiConfidence),
        hasWatermark: Boolean(parsed.hasWatermark),
        watermarkConfidence: clamp(parsed.watermarkConfidence),
      };
    }
  } catch (error) {
    console.warn('[WARN] Gemini supplemental image insight generation failed:', error);
  }

  return null;
}

// Basic placeholder when dedicated deepfake API is unavailable (no LLM)
async function detectImageDeepfake(imageData: string) {
  // Validate image data first
  if (!imageData || !imageData.startsWith('data:image/')) {
    console.warn('Invalid image data for deepfake analysis');
    return {
      isManipulated: false,
      confidence: 0.0,
      explanation: 'Image data is invalid or not provided. Common manipulation techniques include: 1) Photoshop editing for altering content, 2) AI-generated images that look realistic but lack natural details, 3) Deepfakes using facial swapping technology. To protect yourself: verify sources, check metadata, use reverse image search, and consult multiple reliable sources.',
    };
  }

  const parts = imageData.split(';base64,');
  if (parts.length !== 2) {
    console.warn('Invalid image data encoding for deepfake analysis');
    return {
      isManipulated: false,
      confidence: 0.0,
      explanation: 'Image encoding appears malformed. Ensure the image is a valid Base64 data URL before analysis.',
    };
  }

  const header = parts[0];
  const base64Data = parts[1];
  const mimeType = header.replace('data:', '') || 'image/png';

  const structuredPrompt = `You are a senior digital forensics analyst. Inspect the provided image and produce a strict JSON object with this schema:
{
  "isManipulated": boolean,           // true if digitally altered or AI-generated
  "confidence": number,               // confidence 0.0-1.0
  "authenticitySummary": string,      // concise summary of authenticity findings referencing visible cues
  "suspectedTechniques": string[],    // manipulation or generation techniques observed (deepfake, GAN, photoshop, splicing, color grading, compression tampering, etc.)
  "visualIndicators": string[],       // concrete visual clues seen in the image (lighting mismatch, edge halos, warped anatomy, compression noise patterns, etc.)
  "protectionAdvice": string[],       // actionable steps for users to verify or defend against this manipulation
  "metadataNotes": string             // mention metadata limitations if applicable
}

Base your assessment only on the provided pixels. Mention if OCR or metadata was unavailable.`;

  const { geminiVisionModel, geminiTextModel } = await import('../genkit.js');

  const attemptVisionAnalysis = async () => {
    try {
      const result = await geminiVisionModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: structuredPrompt },
            ],
          },
        ],
      });

      const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!responseText.trim()) {
        throw new Error('Empty response from Gemini vision model');
      }

      const cleanJson = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      let parsed: any;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn('Failed to parse Gemini vision JSON, attempting relaxed parse:', parseErr);
        const relaxed = cleanJson
          .replace(/[\r\n]+/g, '\n')
          .replace(/,\s*([}\]])/g, (match, p1) => {
            if (p1 === '{' || p1 === '[') {
              return match.replace(',', '');
            }
            return match;
          });
        parsed = JSON.parse(relaxed);
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid response structure from Gemini vision model');
      }

      const {
        isManipulated = false,
        confidence: rawConfidence = 0.5,
        authenticitySummary = '',
        suspectedTechniques,
        visualIndicators,
        protectionAdvice,
        metadataNotes = '',
      } = parsed as {
        isManipulated?: boolean;
        confidence?: number;
        authenticitySummary?: string;
        suspectedTechniques?: unknown;
        visualIndicators?: unknown;
        protectionAdvice?: unknown;
        metadataNotes?: string;
      };

      const normalizeArray = (value: unknown): string[] => {
        if (Array.isArray(value)) {
          return value.map(item => String(item).trim()).filter(Boolean);
        }
        if (typeof value === 'string' && value.trim()) {
          return [value.trim()];
        }
        return [];
      };

      const suspectedList = normalizeArray(suspectedTechniques);
      const indicatorList = normalizeArray(visualIndicators);
      const adviceList = normalizeArray(protectionAdvice);
      const summaryText = typeof authenticitySummary === 'string' ? authenticitySummary.trim() : '';
      const metadataNotesText = typeof metadataNotes === 'string' ? metadataNotes.trim() : '';
      const confidence = typeof rawConfidence === 'number' ? rawConfidence : 0.5;

      const explanationSections = [
        summaryText,
        suspectedList.length ? `Suspected manipulation techniques: ${suspectedList.join(', ')}.` : null,
        indicatorList.length ? `Key visual indicators: ${indicatorList.join('; ')}.` : null,
        adviceList.length ? `Protection advice: ${adviceList.join('; ')}.` : null,
        metadataNotesText ? `Metadata notes: ${metadataNotesText}` : null,
      ].filter(Boolean);

      return {
        isManipulated: Boolean(isManipulated),
        confidence: Math.max(0, Math.min(1, confidence)),
        explanation: explanationSections.join('\n\n') || 'Analysis completed, no specific indicators provided.',
      };
    } catch (visionError) {
      console.error('Gemini vision deepfake analysis failed:', visionError);
      return null;
    }
  };

  const visionResult = await attemptVisionAnalysis();
  if (visionResult) {
    return visionResult;
  }

  // Fallback: text-only guidance (no image inference)
  const fallbackPrompt = `Analyze potential manipulation in an image where automated vision inspection failed. Provide a concise paragraph covering:
- Whether manipulation is suspected based on context (default to uncertain)
- Typical manipulation techniques to watch for
- Advice for verifying authenticity
Return prose only.`;

  try {
    const fallbackResult = await geminiTextModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: fallbackPrompt }] }],
      generationConfig: { temperature: 0.2 },
    });

    const responseText = fallbackResult.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      isManipulated: false,
      confidence: 0.0,
      explanation: `${responseText.trim() || 'Manual review recommended.'}\n\nProtection advice: Verify the image with reverse search tools, cross-check reputable news outlets, and inspect EXIF metadata when available.`,
    };
  } catch (error) {
    console.error('Gemini text fallback failed for deepfake:', error);
    return {
      isManipulated: false,
      confidence: 0.0,
      explanation: 'Deepfake analysis failed due to API error. Verify the image manually by checking trusted sources, using reverse image search, and inspecting metadata when possible.',
    };
  }
}

// Helper to calculate scores
type ManipulationSignals = {
  isManipulated: boolean;
  confidence: number;
  watermarkConfidence?: number;
  suspectedAIGenerated?: boolean;
  aiConfidence?: number;
};

function calculateScores(contentAnalysis: any, manipulationAnalysis: ManipulationSignals): {
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
  const baseAuthenticity = manipulationAnalysis.isManipulated ? 30 : 85;
  const confidenceBoost = manipulationAnalysis.confidence * 20;
  const watermarkPenalty = (manipulationAnalysis.watermarkConfidence ?? 0) * 25;
  const aiPenalty = manipulationAnalysis.suspectedAIGenerated
    ? 15 + (manipulationAnalysis.aiConfidence ?? manipulationAnalysis.confidence) * 20
    : 0;
  const disputePenalty = (disputedClaims / totalClaims) * 30;
  const contentAuthenticityScore = Math.round(
    Math.max(0, baseAuthenticity + confidenceBoost - disputePenalty - watermarkPenalty - aiPenalty)
  );

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

// Consolidation: Integrated Presentation Formatter
async function formatPresentation(params: {
  description: string;
  ocrText: string;
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  factualClaims: any[];
  webSources: any[];
  understanding?: { description?: string; detectedObjects?: string[]; potentialIssues?: string[] };
  isManipulated?: boolean;
}): Promise<{
  oneLineDescription: string;
  summary: string;
  educationalInsight: string;
  sources: Array<{ url: string; title: string; credibility: number }>;
}> {
  const { description, ocrText, analysisLabel, factualClaims, webSources, understanding, isManipulated } = params;
  // Use the vision understanding description if available (much richer than text-based description)
  const richDescription = understanding?.description || description;

  const detectedObjects = understanding?.detectedObjects?.join(', ') || '';
  const potentialIssues = understanding?.potentialIssues?.join(', ') || '';

  // Filter out bogus claims like "No text is visible" that come from empty OCR
  const meaningfulClaims = factualClaims.filter(c =>
    c.claim && !/no text|no readable text|no discernible/i.test(c.claim)
  );

  // Sanitize web sources for the prompt — only use real ones, never let Gemini invent sources
  const realSources = webSources
    .filter((s: any) => s.url && s.title)
    .slice(0, 5)
    .map((s: any) => ({
      url: String(s.url),
      title: String(s.title),
      credibility: Math.min(1, Math.max(0, typeof s.credibility === 'number' ? (s.credibility > 1 ? s.credibility / 100 : s.credibility) : 0.7)),
    }));

  const prompt = `You are an image misinformation analyst. Analyze the VISUAL CONTENT of this image and produce a JSON response.

IMPORTANT: Focus on what the image VISUALLY SHOWS — faces, objects, scenes, manipulation indicators. Do NOT focus on absence of text.

IMAGE VISUAL ANALYSIS: ${richDescription}
${detectedObjects ? `DETECTED OBJECTS: ${detectedObjects}` : ''}
${potentialIssues ? `VISUAL ISSUES DETECTED: ${potentialIssues}` : ''}
${isManipulated ? `MANIPULATION STATUS: Image shows signs of manipulation/deepfake` : ''}
RISK LEVEL: ${analysisLabel}
${meaningfulClaims.length > 0 ? `VERIFIED CLAIMS: ${meaningfulClaims.map(c => `${c.claim} (${c.verdict})`).join('; ')}` : ''}

Respond with ONLY a valid JSON object:
{
  "oneLineDescription": "concise description of what the image shows and key visual finding",
  "summary": "3-4 sentence detailed visual analysis explaining specific findings about the image content, any manipulation indicators, and assessment",
  "educationalInsight": "150-200 words on how to identify image manipulation (deepfakes, face swaps, AI generation) and protect yourself"
}`;

  try {
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[formatPresentation:image] Response length:', responseText.length, 'first 100:', responseText.substring(0, 100));
    const parsed = tryParseJsonLoose(responseText);
    if (parsed) {
      console.log('[formatPresentation:image] Parsed successfully');
      return {
        oneLineDescription: parsed.oneLineDescription || `${richDescription.substring(0, 150)}`,
        summary: parsed.summary || `Visual analysis of image: ${richDescription}`,
        educationalInsight: parsed.educationalInsight || 'Verify images through reverse image search. Check for visual inconsistencies and unnatural features.',
        // ALWAYS use real web sources — never Gemini-generated sources
        sources: realSources,
      };
    }
    console.warn('[WARN] Image formatPresentation: tryParseJsonLoose returned null, raw:', responseText.substring(0, 300));
  } catch (error) {
    console.error('[ERROR] Image presentation formatting failed:', error);
  }

  // Data-driven fallback using actual analysis results
  console.warn('[WARN] Image formatPresentation Gemini call failed — using data fallback');

  const manipulationNote = isManipulated ? ' Potential manipulation or deepfake detected.' : '';
  const oneLineDescription = richDescription && richDescription !== 'Image understanding unavailable'
    ? `${richDescription.substring(0, 200)}${manipulationNote}`
    : `Image content analysis completed — ${analysisLabel} risk level.${manipulationNote}`;

  const summaryParts: string[] = [];
  if (richDescription && richDescription !== 'Image understanding unavailable') {
    summaryParts.push(richDescription);
  }
  if (potentialIssues) summaryParts.push(`Visual issues detected: ${potentialIssues}.`);
  if (manipulationNote) summaryParts.push(manipulationNote.trim());
  if (meaningfulClaims.length > 0) {
    summaryParts.push(`Claims: ${meaningfulClaims.map(c => `${c.claim} (${c.verdict})`).join('; ')}.`);
  }
  summaryParts.push(`Risk level: ${analysisLabel}.`);

  return {
    oneLineDescription,
    summary: summaryParts.join(' '),
    educationalInsight: 'Verify images through reverse image search tools like TinEye or Google Images. Check for visual inconsistencies, unnatural lighting, and blurred edges that may indicate manipulation or AI generation. Deepfake technology can swap faces convincingly — look for mismatched skin tones, inconsistent lighting on the face vs background, and artifacts around face edges.',
    // ALWAYS use real web sources
    sources: realSources.length > 0 ? realSources : [
      { url: 'https://www.tineye.com', title: 'TinEye Reverse Image Search', credibility: 0.88 },
      { url: 'https://www.snopes.com', title: 'Snopes Fact Checking', credibility: 0.95 },
    ]
  };
}

// Main analysis function
export async function analyzeImageContent(input: ImageAnalysisInput, options?: { searchEngineId?: string }): Promise<ImageAnalysisOutput> {
  try {
    // Run metadata, OCR, deepfake detection, and reverse image search concurrently
    const metadataPromise = extractImageMetadata(input.imageData);
    const ocrPromise = performOcr(input.imageData);
    const understandingPromise = geminiImageUnderstanding(input.imageData, input.mimeType);
    const vertexInsightPromise = getVertexImageInsights(input.imageData, input.mimeType);
    const deepfakePromise = (async () => {
      try {
        const deepfakeResult = await detectDeepfake({ media: input.imageData, contentType: 'image' });
        return { isManipulated: deepfakeResult.isDeepfake, manipulationConfidence: deepfakeResult.confidenceScore / 100 };
      } catch (error) {
        console.error('Deepfake detection failed:', error);
        const basic = await detectImageDeepfake(input.imageData);
        return { isManipulated: basic.isManipulated, manipulationConfidence: basic.confidence };
      }
    })();

    const [visionMetadata, ocrText, understanding, deepfakeInfo, vertexInsights] = await Promise.all([
      metadataPromise,
      ocrPromise,
      understandingPromise,
      deepfakePromise,
      vertexInsightPromise,
    ]);

    // Analyze content and fact-check (requires OCR text if any)
    const contentAnalysis = await analyzeImageContentAndFactCheck(input.imageData, ocrText);
    const vertexTextInsights = contentAnalysis.vertexTextInsights;
    const vertexSuggestsManipulation = Boolean(vertexInsights?.suspectedAIGenerated && (vertexInsights.aiConfidence ?? 0) >= 0.6);
    const combinedIsManipulated = deepfakeInfo.isManipulated || vertexSuggestsManipulation;
    const combinedManipulationConfidence = Math.max(
      deepfakeInfo.manipulationConfidence,
      vertexInsights?.aiConfidence ?? 0
    );

    // Step 5: Web analysis for context
    const enrichedWatermarkIndicators = Array.from(new Set([
      ...(visionMetadata.watermarkFindings?.indicators ?? []),
      ...(vertexInsights?.watermarkIndicators ?? []),
    ]));

    const combinedWatermarkConfidence = Math.max(
      visionMetadata.watermarkFindings?.confidence ?? 0,
      vertexInsights?.watermarkConfidence ?? 0
    );

    const combinedHasWatermark = (visionMetadata.watermarkFindings?.hasWatermark ?? false)
      || Boolean(vertexInsights?.hasWatermark && combinedWatermarkConfidence >= 0.5);

    const combinedAiIndicators = Array.from(new Set([
      ...visionMetadata.aiIndicators,
      ...(vertexInsights?.aiIndicators ?? []),
    ]));

    const combinedSuspectedAIGenerated = Boolean(
      vertexInsights?.suspectedAIGenerated || visionMetadata.suspectedAIGenerated
    );

    const enrichedMetadata: ExtractedImageSignals & {
      vertexInsights?: VertexImageInsights | null;
    } = {
      ...visionMetadata,
      watermarkFindings: {
        hasWatermark: combinedHasWatermark,
        confidence: combinedWatermarkConfidence,
        indicators: enrichedWatermarkIndicators,
      },
      suspectedAIGenerated: combinedSuspectedAIGenerated,
      aiIndicators: combinedAiIndicators,
      ...(vertexInsights
        ? { vertexInsights: vertexInsights }
        : {}),
    };

    const reverseSearchQueries = deriveReverseImageQueries({ metadata: enrichedMetadata, ocrText, vertexInsights });
    const webSourcesMap = new Map<string, any>();

    const searchResults = await Promise.allSettled(
      reverseSearchQueries.slice(0, 3).map((query: string) =>
        performWebAnalysis({
          query,
          contentType: 'text',
          mediaType: 'image',
          searchEngineId: options?.searchEngineId,
        })
      )
    );

    for (const result of searchResults) {
      if (result.status === 'fulfilled') {
        for (const source of result.value.currentInformation || []) {
          if (source?.url && !webSourcesMap.has(source.url)) {
            webSourcesMap.set(source.url, source);
          }
        }
      } else {
        console.error('Web analysis failed:', result.reason);
      }
    }

    let webSources = Array.from(webSourcesMap.values());

    try {
      const guidedQueries = await buildGeminiGuidedSearchQueries(understanding, ocrText);
      const reverseQueries = buildReverseImageQueries(understanding, ocrText);
      const combinedQueries = Array.from(new Set([...reverseQueries, ...guidedQueries]));
      if (combinedQueries.length > 0) {
        const reverseSources = await reverseImageGrounding(combinedQueries, options?.searchEngineId);
        if (reverseSources.length > 0) {
          const byUrl = new Map<string, any>();
          for (const s of webSources) if (s?.url) byUrl.set(s.url, s);
          for (const s of reverseSources) if (s?.url && !byUrl.has(s.url)) byUrl.set(s.url, s);
          webSources = Array.from(byUrl.values());
        }
      }
    } catch (error) {
      console.warn('[WARN] Guided reverse image search failed:', error);
    }

    // Step 6: Determine analysis label
    const watermarkConfidence = enrichedMetadata.watermarkFindings?.confidence ?? 0;
    const watermarkConcern = enrichedMetadata.watermarkFindings?.hasWatermark && watermarkConfidence >= 0.6;
    const suspectedAIGenerated = Boolean(enrichedMetadata.suspectedAIGenerated);
    const safeSearchFlags = enrichedMetadata.safeSearch || {};
    const safeSearchConcern = ['adult', 'violence', 'racy'].some((field) => {
      const value = (safeSearchFlags as Record<string, string>)[field];
      return value === 'LIKELY' || value === 'VERY_LIKELY';
    });

    const vertexWatermarkConcern = Boolean(vertexInsights?.hasWatermark && (vertexInsights.watermarkConfidence ?? 0) >= 0.6);
    const vertexAIGeneratedConcern = Boolean(vertexInsights?.suspectedAIGenerated && (vertexInsights.aiConfidence ?? 0) >= 0.7);
    const textRiskConcern = Boolean(
      vertexTextInsights?.riskIndicators?.some((indicator) => /fake|misinfo|misleading|scam|warning|propaganda|deceptive/i.test(indicator))
    );

    let analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN' = 'YELLOW';
    if (combinedIsManipulated && combinedManipulationConfidence >= 0.7) {
      analysisLabel = 'RED';
    } else if (
      safeSearchConcern ||
      watermarkConcern ||
      vertexWatermarkConcern ||
      vertexAIGeneratedConcern ||
      textRiskConcern ||
      suspectedAIGenerated ||
      contentAnalysis.factualClaims.some((c: any) => c.verdict === 'DISPUTED')
    ) {
      analysisLabel = 'ORANGE';
    } else if (
      !combinedIsManipulated &&
      !watermarkConcern &&
      !vertexWatermarkConcern &&
      !suspectedAIGenerated &&
      contentAnalysis.factualClaims.length > 0 &&
      contentAnalysis.factualClaims.every((c: any) => c.verdict === 'VERIFIED')
    ) {
      analysisLabel = 'GREEN';
    }

    // Step 7: Calculate scores
    const scores = calculateScores(contentAnalysis, {
      isManipulated: combinedIsManipulated,
      confidence: combinedManipulationConfidence,
      watermarkConfidence,
      suspectedAIGenerated,
      aiConfidence: vertexInsights?.aiConfidence,
    });

    // Step 8: Consolidated formatting
    console.log('[DEBUG:image] understanding.description:', understanding?.description?.substring(0, 150));
    console.log('[DEBUG:image] contentAnalysis.description:', contentAnalysis.description?.substring(0, 150));
    console.log('[DEBUG:image] combinedIsManipulated:', combinedIsManipulated);
    const presentation = await formatPresentation({
      description: contentAnalysis.description,
      ocrText,
      analysisLabel,
      factualClaims: contentAnalysis.factualClaims,
      webSources,
      understanding,
      isManipulated: combinedIsManipulated,
    });

    const deepAnalysis = await generateDeepAnalysisNarrative({
      understanding,
      ocrText,
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
      sources: presentation.sources || [],
      sourceIntegrityScore: scores.sourceIntegrityScore,
      contentAuthenticityScore: scores.contentAuthenticityScore,
      trustExplainabilityScore: scores.trustExplainabilityScore,
      metadata: {
        location: enrichedMetadata.location,
        ocrText,
        description: contentAnalysis.description,
        isManipulated: combinedIsManipulated,
        understandingDescription: understanding.description,
      },
      deepAnalysis,
    };
  } catch (error) {
    console.error('Error in image analysis:', error);

    // Return error response with proper format
    return {
      analysisLabel: 'RED',
      oneLineDescription: 'Image analysis encountered an error',
      summary: 'The image analysis could not be completed due to technical issues. Please verify the image format and try again.',
      educationalInsight: 'When image analysis fails, use manual verification methods like reverse image search and visual inspection for inconsistencies.',
      sources: [
        { url: 'https://www.tineye.com', title: 'TinEye Reverse Image Search', credibility: 0.9 }
      ],
      sourceIntegrityScore: 0,
      contentAuthenticityScore: 0,
      trustExplainabilityScore: 0,
      metadata: {},
      deepAnalysis: {
        what: 'Image analysis unavailable due to an internal error.',
        how: 'Processing failed before deep insights could be created.',
        why: 'The system could not infer motivation or impact.',
        when: 'Temporal context was not established.',
        educationalInsights: [
          'Retry the analysis later and corroborate with manual fact-checking resources.'
        ],
      }
    };
  }
}
