import { z } from 'zod';
import { performWebAnalysis } from './perform-web-analysis.js';
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
    originalTranscription: z.string().optional(),
    detectedLanguage: z.string().optional(),
    factualClaims: z.array(z.object({
      claim: z.string(),
      verdict: z.enum(['VERIFIED', 'DISPUTED', 'UNVERIFIED']),
      confidence: z.number().min(0).max(1),
    })).optional(),
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
 * Perform Multimodal Audio Analysis with Gemini 2.5 Flash
 * Bypasses legacy STT and handles regional Indian languages.
 */
async function analyzeAudioWithGemini(audioData: string, mimeType?: string): Promise<{
  nativeTranscription: string;
  englishTranslation: string;
  claimsToVerify: string[];
  isManipulated: boolean;
  voiceAnalysis: {
    isSynthetic: boolean;
    isMimicry: boolean;
    isDubbed: boolean;
    confidence: number;
    indicators: string[];
  };
}> {
  try {
    // Convert buffer/base64 to strictly base64 string
    const base64Data = audioData.includes(',') ? audioData.split(',')[1] : audioData;

    const systemInstruction = `You are an elite multilingual audio forensics AI. Listen to the provided audio file with extreme skepticism. Your job is to DETECT AI-generated and manipulated audio.

CRITICAL: Modern AI voice generators (ElevenLabs, Bark, XTTS, OpenAI TTS, Google TTS) produce extremely natural-sounding voices that can fool casual listeners. Be HIGHLY SUSPICIOUS of any audio that:
- Has TOO-PERFECT pronunciation or enunciation
- Lacks natural speech disfluencies (um, uh, false starts, self-corrections)
- Has unnaturally smooth prosody or consistent pacing
- Sounds like a polished narration/monologue rather than natural speech
- Has uniform background noise or suspiciously clean audio
- Lacks micro-variations in breathing patterns
- Has emotional tone that feels performed rather than genuine

TASKS:
1. Transcribe the audio in its native language.
2. Translate the transcription to English.
3. Extract factual claims from the content.
4. Perform VOICE FORENSIC ANALYSIS. Consider:
   - Is this a text-to-speech (TTS) or AI-cloned voice? Modern TTS is very natural.
   - Is someone mimicking/impersonating another person's voice?
   - Is this dubbed audio (voice track replaced)?
   - Rate naturalness: does it sound like genuine spontaneous speech or scripted/generated?

IMPORTANT: If in doubt, lean toward flagging as potentially synthetic. It is better to warn about a real voice than to miss an AI-generated one. Only mark isSynthetic as false if you are highly confident this is genuine human speech with clear natural characteristics (genuine hesitations, breathing irregularities, background environmental sounds, interruptions).

Respond with ONLY a JSON object:
{
  "nativeTranscription": "transcription in original language",
  "englishTranslation": "English translation",
  "claimsToVerify": ["claim1", "claim2"],
  "isManipulated": true/false,
  "voiceAnalysis": {
    "isSynthetic": true/false,
    "isMimicry": true/false,
    "isDubbed": true/false,
    "confidence": 0.0-1.0,
    "indicators": ["specific indicator 1", "specific indicator 2"]
  }
}`;

    const result = await generativeModel.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: base64Data,
            }
          },
          { text: systemInstruction }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = tryParseJsonLoose(text);

    const voiceAnalysis = parsed?.voiceAnalysis || {};

    return {
      nativeTranscription: String(parsed?.nativeTranscription || '').trim(),
      englishTranslation: String(parsed?.englishTranslation || '').trim(),
      claimsToVerify: Array.isArray(parsed?.claimsToVerify) ? parsed.claimsToVerify : [],
      isManipulated: Boolean(parsed?.isManipulated || voiceAnalysis.isSynthetic || voiceAnalysis.isMimicry || voiceAnalysis.isDubbed),
      voiceAnalysis: {
        isSynthetic: Boolean(voiceAnalysis.isSynthetic),
        isMimicry: Boolean(voiceAnalysis.isMimicry),
        isDubbed: Boolean(voiceAnalysis.isDubbed),
        confidence: typeof voiceAnalysis.confidence === 'number' ? Math.min(1, Math.max(0, voiceAnalysis.confidence)) : 0.5,
        indicators: Array.isArray(voiceAnalysis.indicators) ? voiceAnalysis.indicators.map((i: any) => String(i)) : [],
      },
    };
  } catch (error) {
    console.error('[ERROR] Gemini multimodal audio analysis failed:', error);
    throw error;
  }
}

// Authenticity derived from claims and Gemini analysis
function deriveAudioAuthenticity(
  factualClaims: Array<{ verdict: string; confidence: number }>,
  isManipulated: boolean
) {
  const verified = factualClaims.filter(c => c.verdict === 'VERIFIED').length;
  const disputed = factualClaims.filter(c => c.verdict === 'DISPUTED').length;
  
  const isAuthentic = !isManipulated && (disputed <= verified);
  const confidence = isManipulated ? 0.9 : 0.7;
  
  return {
    isAuthentic,
    confidence,
    explanation: isManipulated 
      ? "Gemini forensics detected signs of audio manipulation or synthetic generation."
      : "Authenticity assessed via claim verification and forensic analysis.",
    indicators: isManipulated ? ['AI Manipulation Detected'] : [] as string[],
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

  const verificationRate = verifiedClaims / totalClaims;
  const sourceBoost = Math.min(20, webSources * 5);
  const sourceIntegrityScore = Math.round(verificationRate * 80 + sourceBoost);

  const baseAuthenticity = authenticityAnalysis.isAuthentic ? 70 : 20;
  const confidenceBoost = authenticityAnalysis.confidence * 30;
  const disputePenalty = (disputedClaims / totalClaims) * 20;
  const contentAuthenticityScore = Math.round(Math.max(0, baseAuthenticity + confidenceBoost - disputePenalty));

  const avgConfidence = factualClaims.length > 0 
    ? factualClaims.reduce((sum, c) => sum + c.confidence, 0) / factualClaims.length
    : 0.5;
    
  const trustExplainabilityScore = Math.round(
    (sourceIntegrityScore * 0.4 + contentAuthenticityScore * 0.4 + avgConfidence * 100 * 0.2)
  );

  return {
    sourceIntegrityScore: Math.min(100, sourceIntegrityScore),
    contentAuthenticityScore: Math.min(100, contentAuthenticityScore),
    trustExplainabilityScore: Math.min(100, trustExplainabilityScore),
  };
}

// Consolidation: Integrated Presentation Formatter
async function formatPresentation(params: {
  transcription: string;
  nativeTranscription: string;
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  claims: any[];
  webSources: any[];
  isManipulated: boolean;
  voiceAnalysis: {
    isSynthetic: boolean;
    isMimicry: boolean;
    isDubbed: boolean;
    confidence: number;
    indicators: string[];
  };
}): Promise<{
  oneLineDescription: string;
  summary: string;
  educationalInsight: string;
  sources: Array<{ url: string; title: string; credibility: number }>;
}> {
  const { transcription, nativeTranscription, analysisLabel, claims, webSources, isManipulated, voiceAnalysis } = params;

  // Build real sources list — never let Gemini invent sources
  const realSources = webSources
    .filter((s: any) => s.url && s.title)
    .slice(0, 5)
    .map((s: any) => ({
      url: String(s.url),
      title: String(s.title),
      credibility: Math.min(1, Math.max(0, typeof s.credibility === 'number' ? (s.credibility > 1 ? s.credibility / 100 : s.credibility) : 0.7)),
    }));

  // Build user-friendly voice status (not raw indicators)
  const voiceStatus = voiceAnalysis.isSynthetic ? 'AI-generated or synthetic voice detected'
    : voiceAnalysis.isMimicry ? 'Voice mimicry or impersonation detected'
    : voiceAnalysis.isDubbed ? 'Dubbed or overlaid audio detected'
    : isManipulated ? 'Audio manipulation detected'
    : 'Voice appears to be natural human speech';

  // Build context for Gemini prompt (include raw indicators here, they're for the AI not the user)
  const contextParts: string[] = [];
  contextParts.push(`AUDIO TRANSCRIPTION: "${transcription.substring(0, 800)}"`);
  if (nativeTranscription && nativeTranscription !== transcription) {
    contextParts.push(`ORIGINAL LANGUAGE: "${nativeTranscription.substring(0, 300)}"`);
  }
  contextParts.push(`RISK LEVEL: ${analysisLabel}`);
  contextParts.push(`VOICE STATUS: ${voiceStatus}`);
  if (voiceAnalysis.indicators.length > 0) {
    contextParts.push(`FORENSIC INDICATORS: ${voiceAnalysis.indicators.join('; ')}`);
  }
  contextParts.push(`FORENSIC CONFIDENCE: ${(voiceAnalysis.confidence * 100).toFixed(0)}%`);
  if (claims.length > 0) {
    contextParts.push(`CLAIMS: ${claims.map(c => `${c.claim} (${c.verdict})`).join('; ')}`);
  }

  const prompt = `You are an audio forensics analyst writing for a general audience. Based on the analysis below, produce a user-friendly JSON response.

IMPORTANT: Write clear, readable descriptions. Do NOT dump raw technical indicators. Focus on what the audio says, whether the voice sounds authentic, and what the user should know.

${contextParts.join('\n')}

Respond with ONLY a valid JSON object (all 3 fields required, no markdown):
{"oneLineDescription":"1-2 sentence: what the audio says and whether the voice is real or AI","summary":"3-4 readable sentences: what was said, voice authenticity assessment, and any concerns","educationalInsight":"150-200 words on voice cloning awareness and protection tips"}`;

  try {
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4000 }
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[formatPresentation:audio] Response length:', responseText.length, 'first 100:', responseText.substring(0, 100));
    const parsed = tryParseJsonLoose(responseText);
    if (parsed) {
      console.log('[formatPresentation:audio] Parsed successfully');
      return {
        oneLineDescription: parsed.oneLineDescription || `Audio: ${transcription.substring(0, 100)}`,
        summary: parsed.summary || `Audio transcription: ${transcription}`,
        educationalInsight: parsed.educationalInsight || 'Be cautious of AI-generated voices and voice cloning technology.',
        // ALWAYS use real web sources
        sources: realSources,
      };
    }
    console.warn('[WARN] Audio formatPresentation: tryParseJsonLoose returned null, raw:', responseText.substring(0, 500));
  } catch (error) {
    console.error('[ERROR] Audio presentation formatting failed:', error);
  }

  // Data-driven fallback — clean, user-friendly text (NO raw indicators)
  console.warn('[WARN] Audio formatPresentation Gemini call failed — using data fallback');

  const oneLineDescription = transcription
    ? `The audio discusses: "${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}" — ${voiceStatus}.`
    : `Audio analysis completed — ${voiceStatus}.`;

  const summaryParts: string[] = [];
  if (transcription) {
    summaryParts.push(`The speaker says: "${transcription.substring(0, 200)}${transcription.length > 200 ? '...' : ''}"`);
  }
  summaryParts.push(`Voice assessment: ${voiceStatus} (confidence: ${(voiceAnalysis.confidence * 100).toFixed(0)}%).`);
  if (claims.length > 0) {
    const claimTexts = claims.map(c => `"${c.claim}" — ${c.verdict.toLowerCase()}`).join(', ');
    summaryParts.push(`Content claims: ${claimTexts}.`);
  }

  return {
    oneLineDescription,
    summary: summaryParts.join(' '),
    educationalInsight: 'AI voice cloning technology can now replicate anyone\'s voice from just a few seconds of audio. Services like ElevenLabs make this widely accessible. To protect yourself: always verify unexpected audio messages through official channels, be skeptical of urgent or emotional voice messages from unknown sources, and listen for subtle signs like unnaturally perfect pronunciation or missing natural speech patterns (breathing, hesitation).',
    sources: realSources.length > 0 ? realSources : [
      { url: 'https://www.factcheck.org', title: 'FactCheck.org', credibility: 0.93 },
      { url: 'https://www.reuters.com/fact-check', title: 'Reuters Fact Check', credibility: 0.94 },
    ]
  };
}

// Main analysis function
export async function analyzeAudioContent(input: AudioAnalysisInput, options?: { searchEngineId?: string }): Promise<AudioAnalysisOutput> {
  try {
    // Step 1: Gemini Multimodal Analysis (Transcription + Forensic)
    const geminiResult = await analyzeAudioWithGemini(input.audioData, input.mimeType);

    if (!geminiResult.englishTranslation && !geminiResult.nativeTranscription) {
      throw new Error('Failed to analyze audio with Gemini');
    }

    // Step 2: Fact-check extracted claims
    const factCheckedClaims = await Promise.all(
      geminiResult.claimsToVerify.map(async (claim) => {
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

    // Step 3: Analyze authenticity
    const authenticityAnalysis = deriveAudioAuthenticity(factCheckedClaims, geminiResult.isManipulated);

    // Step 4: Perform web analysis for context
    let webSources: any[] = [];
    try {
      const webAnalysis = await performWebAnalysis({
        query: geminiResult.englishTranslation.substring(0, 500),
        contentType: 'text',
        mediaType: 'audio',
        searchEngineId: options?.searchEngineId
      });
      webSources = webAnalysis.currentInformation || [];
    } catch (error) {
      console.error('Web analysis failed:', error);
    }

    // Step 5: Determine analysis label
    let analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN' = 'YELLOW';
    if (geminiResult.isManipulated) {
      analysisLabel = 'RED';
    } else if (!authenticityAnalysis.isAuthentic) {
      analysisLabel = 'ORANGE';
    } else if (authenticityAnalysis.isAuthentic && authenticityAnalysis.confidence > 0.8) {
      analysisLabel = 'GREEN';
    }

    // Step 6: Calculate scores
    const scores = calculateScores(factCheckedClaims, authenticityAnalysis, (webSources?.length || 0));

    // Step 7: Consolidated formatting
    console.log('[DEBUG:audio] isManipulated:', geminiResult.isManipulated, 'voiceAnalysis:', JSON.stringify(geminiResult.voiceAnalysis));
    const presentation = await formatPresentation({
      transcription: geminiResult.englishTranslation,
      nativeTranscription: geminiResult.nativeTranscription,
      analysisLabel,
      claims: factCheckedClaims,
      webSources,
      isManipulated: geminiResult.isManipulated,
      voiceAnalysis: geminiResult.voiceAnalysis,
    });

    // Build forensic description for deepAnalysis
    const voiceFlags: string[] = [];
    if (geminiResult.voiceAnalysis.isSynthetic) voiceFlags.push('AI-generated/synthetic voice');
    if (geminiResult.voiceAnalysis.isMimicry) voiceFlags.push('Voice mimicry/impersonation');
    if (geminiResult.voiceAnalysis.isDubbed) voiceFlags.push('Dubbed/overlaid audio');
    if (geminiResult.voiceAnalysis.indicators.length > 0) voiceFlags.push(...geminiResult.voiceAnalysis.indicators);

    const howDescription = geminiResult.isManipulated
      ? `Voice forensic analysis detected: ${voiceFlags.join('; ') || 'signs of audio manipulation'}. Confidence: ${(geminiResult.voiceAnalysis.confidence * 100).toFixed(0)}%.`
      : 'Audio voice analysis indicates natural human speech with no signs of synthetic generation, mimicry, or dubbing.';

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
        format: input.mimeType || 'audio/webm',
        transcription: geminiResult.englishTranslation,
        originalTranscription: geminiResult.nativeTranscription,
        factualClaims: factCheckedClaims,
      },
      deepAnalysis: {
        what: geminiResult.englishTranslation,
        how: howDescription,
        why: 'Audio deepfakes and voice cloning are increasingly used to spread misinformation, impersonate public figures, and conduct fraud.',
        when: 'Real-time analysis performed on uploaded content.',
        educationalInsights: [
          'AI voice cloning can replicate voices from just seconds of sample audio — always verify audio identity through official channels.',
          'Listen for robotic cadence, uniform pitch, missing breath sounds, or too-perfect pronunciation as indicators of synthetic speech.',
          ...geminiResult.voiceAnalysis.indicators.slice(0, 3),
        ].filter(Boolean),
      }
    };
  } catch (error) {
    console.error('Error in audio analysis:', error);

    return {
      analysisLabel: 'RED',
      oneLineDescription: 'Audio analysis encountered an error',
      summary: 'The audio analysis could not be completed due to technical issues.',
      educationalInsight: 'Check if the audio format is supported and clear for processing.',
      sources: [],
      sourceIntegrityScore: 0,
      contentAuthenticityScore: 0,
      trustExplainabilityScore: 0,
      metadata: { format: input.mimeType || 'unknown' },
      deepAnalysis: {
        what: 'Analysis failed.',
        how: 'Technical error in multimodal processing.',
        why: 'N/A',
        when: 'N/A',
        educationalInsights: ['Corroborate claims manually when automated analysis is unavailable.']
      }
    };
  }
}
