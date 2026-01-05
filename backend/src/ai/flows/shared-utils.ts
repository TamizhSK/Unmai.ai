import { generativeModel } from '../ai-models.js';

// Shared JSON parsing utility
export function tryParseJsonLoose(text: string): any {
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

// Shared deep analysis narrative generation
export async function generateDeepAnalysisNarrative(params: {
  contentType: 'image' | 'video' | 'audio' | 'text' | 'url';
  understanding?: any;
  transcription?: string;
  ocrText?: string;
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  existingEducationalInsight?: string;
  sources: Array<{ url: string; title: string }>;
  events?: string[];
  claims?: any[];
}): Promise<{
  what: string;
  how: string;
  why: string;
  when: string;
  educationalInsights: string[];
}> {
  try {
    const contextData = {
      contentType: params.contentType,
      analysisLabel: params.analysisLabel,
      sources: params.sources,
      existingEducationalInsight: params.existingEducationalInsight,
      ...(params.understanding && { understanding: params.understanding }),
      ...(params.transcription && { transcription: params.transcription }),
      ...(params.ocrText && { ocrText: params.ocrText }),
      ...(params.events && { events: params.events }),
      ...(params.claims && { claims: params.claims }),
    };

    const prompt = `You extend a ${params.contentType} misinformation report with educational framing. Using the structured context below, output STRICT JSON:\n{\n  "what": "Concise description of what the content shows or contains",\n  "how": "Explain techniques used or how content was produced/manipulated", \n  "why": "Explain why the content exists or matters",\n  "when": "Temporal clues or contextual timing",\n  "educationalInsights": ["Actionable media literacy tips"]\n}\n\nStructured context:\n${JSON.stringify(contextData).slice(0, 3000)}`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
    });

    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);
    
    if (parsed && typeof parsed === 'object') {
      return {
        what: String(parsed.what || '').trim() || 'Detailed description unavailable.',
        how: String(parsed.how || '').trim() || 'Production/manipulation techniques could not be determined.',
        why: String(parsed.why || '').trim() || 'Motivation or impact remains unclear.',
        when: String(parsed.when || '').trim() || 'Temporal context could not be inferred.',
        educationalInsights: Array.isArray(parsed.educationalInsights)
          ? parsed.educationalInsights.map((v: any) => String(v || '').trim()).filter((v: string) => v.length > 0)
          : [],
      };
    }
  } catch (error) {
    console.warn(`[WARN] Gemini ${params.contentType} deep analysis narrative failed:`, error);
  }

  const fallbackInsight = params.existingEducationalInsight
    ? [params.existingEducationalInsight]
    : [`Cross-verify ${params.contentType} content with multiple reliable sources and use appropriate verification tools.`];

  return {
    what: 'Detailed description unavailable due to limited context.',
    how: 'Content production or manipulation techniques could not be identified.',
    why: 'The motivation or impact of this content remains unclear.',
    when: 'Temporal context could not be determined.',
    educationalInsights: fallbackInsight,
  };
}

// Removed buildGeminiGuidedSearchQueries - not used after CSE removal for speed optimization

// Shared score calculation logic
export function calculateStandardScores(params: {
  verifiedClaims: number;
  disputedClaims: number;
  totalClaims: number;
  isAuthentic?: boolean;
  authenticityConfidence?: number;
  webSourcesCount?: number;
  avgClaimConfidence?: number;
}): {
  sourceIntegrityScore: number;
  contentAuthenticityScore: number;
  trustExplainabilityScore: number;
} {
  const {
    verifiedClaims,
    disputedClaims,
    totalClaims,
    isAuthentic = true,
    authenticityConfidence = 0.5,
    webSourcesCount = 0,
    avgClaimConfidence = 0.5
  } = params;

  const normalizedTotalClaims = Math.max(1, totalClaims);

  // Source Integrity Score (0-100)
  const verificationRate = verifiedClaims / normalizedTotalClaims;
  const sourceAvailability = Math.min(1, webSourcesCount / 5);
  const sourceIntegrityScore = Math.round(
    verificationRate * 60 + 
    sourceAvailability * 25 + 
    avgClaimConfidence * 15
  );

  // Content Authenticity Score (0-100)
  const baseAuthenticity = isAuthentic ? 75 : 25;
  const confidenceBoost = authenticityConfidence * 25;
  const disputePenalty = (disputedClaims / normalizedTotalClaims) * 40;
  const contentAuthenticityScore = Math.round(
    Math.max(0, baseAuthenticity + confidenceBoost - disputePenalty)
  );

  // Trust Explainability Score (0-100)
  const trustExplainabilityScore = Math.round(
    contentAuthenticityScore * 0.5 + 
    sourceIntegrityScore * 0.3 + 
    avgClaimConfidence * 100 * 0.2
  );

  return {
    sourceIntegrityScore: Math.min(100, Math.max(0, sourceIntegrityScore)),
    contentAuthenticityScore: Math.min(100, Math.max(0, contentAuthenticityScore)),
    trustExplainabilityScore: Math.min(100, Math.max(0, trustExplainabilityScore)),
  };
}

// Shared reference sources generation for different content types
export function getStandardReferenceSources(contentType: 'image' | 'video' | 'audio' | 'text' | 'url'): Array<{
  title: string;
  url: string;
  snippet: string;
  date: string;
  relevance: number;
  credibility: number;
}> {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const commonSources = [
    {
      title: 'FactCheck.org',
      url: 'https://www.factcheck.org/',
      snippet: 'Nonpartisan fact-checking resource for verifying claims',
      date: currentDate,
      relevance: 95,
      credibility: 0.95
    },
    {
      title: 'Snopes',
      url: 'https://www.snopes.com/',
      snippet: 'Comprehensive fact-checking for rumors and misinformation',
      date: currentDate,
      relevance: 90,
      credibility: 0.92
    },
    {
      title: 'PolitiFact - Truth-O-Meter',
      url: 'https://www.politifact.com/',
      snippet: 'Fact-checking statements and political claims',
      date: currentDate,
      relevance: 88,
      credibility: 0.90
    },
    {
      title: 'Reuters Fact Check',
      url: 'https://www.reuters.com/fact-check/',
      snippet: 'Professional news agency fact-checking service',
      date: currentDate,
      relevance: 92,
      credibility: 0.94
    },
    {
      title: 'AP Fact Check',
      url: 'https://apnews.com/hub/ap-fact-check',
      snippet: 'Associated Press fact-checking and verification',
      date: currentDate,
      relevance: 91,
      credibility: 0.93
    }
  ];

  const specificSources: Record<string, Array<{ title: string; url: string; snippet: string; date: string; relevance: number; credibility: number; }>> = {
    image: [
      {
        title: 'TinEye Reverse Image Search',
        url: 'https://www.tineye.com/',
        snippet: 'Reverse image search to find original sources',
        date: currentDate,
        relevance: 95,
        credibility: 0.88
      }
    ],
    video: [
      {
        title: 'Deepware AI Detection',
        url: 'https://www.deepware.ai/',
        snippet: 'AI-powered deepfake detection for video content',
        date: currentDate,
        relevance: 95,
        credibility: 0.85
      }
    ],
    audio: [
      {
        title: 'AudioSet by Google',
        url: 'https://research.google.com/audioset/',
        snippet: 'Audio event detection and verification resources',
        date: currentDate,
        relevance: 85,
        credibility: 0.90
      }
    ],
    text: [],
    url: [
      {
        title: 'VirusTotal URL Scanner',
        url: 'https://www.virustotal.com/gui/home/url',
        snippet: 'URL security and reputation scanner',
        date: currentDate,
        relevance: 93,
        credibility: 0.93
      }
    ]
  };

  const contentSpecificSources = specificSources[contentType] || [];
  return [...contentSpecificSources, ...commonSources].slice(0, 5);
}