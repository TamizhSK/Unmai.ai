import { z } from 'zod';
import { SpeechClient } from '@google-cloud/speech';
import { performWebAnalysis } from './perform-web-analysis.js';
import { formatUnifiedPresentation } from './format-unified-presentation.js';
import { factCheckClaim } from './fact-check-claim.js';
const AudioAnalysisInputSchema = z.object({
    audioData: z.string().min(1, 'Audio data is required'),
    mimeType: z.string().optional(),
});
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
    }).optional(),
});
// Helper to transcribe audio using Google Speech-to-Text
async function transcribeAudio(audioData, mimeType) {
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
    };
    const sampleRateMap = {
        OGG_OPUS: 48000,
        AMR: 8000,
        AMR_WB: 16000,
        LINEAR16: 16000,
    };
    const encodingFromMime = (mimeType && (mimeType in encodingMap)
        ? encodingMap[mimeType]
        : 'LINEAR16');
    const sampleRateHertz = sampleRateMap[encodingFromMime];
    const config = {
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
    }
    catch (error) {
        console.error('Speech-to-Text error:', error);
        return '';
    }
}
// Helper to extract and fact-check claims from transcription (heuristic extraction)
async function extractAndFactCheckClaims(transcription) {
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
    const factCheckedClaims = await Promise.all(claims.map(async (claim) => {
        try {
            const result = await factCheckClaim({ claim });
            return {
                claim,
                verdict: result.verdict === 'True' ? 'VERIFIED' :
                    result.verdict === 'False' ? 'DISPUTED' : 'UNVERIFIED',
                confidence: result.verdict === 'Uncertain' ? 0.3 : 0.7,
            };
        }
        catch {
            return { claim, verdict: 'UNVERIFIED', confidence: 0.3 };
        }
    }));
    return factCheckedClaims;
}
// Authenticity derived from fact-check results (no LLM)
function deriveAudioAuthenticity(factualClaims) {
    const total = Math.max(1, factualClaims.length);
    const verified = factualClaims.filter(c => c.verdict === 'VERIFIED').length;
    const disputed = factualClaims.filter(c => c.verdict === 'DISPUTED').length;
    const isAuthentic = disputed <= verified;
    const confidence = Math.min(1, Math.max(0, (verified - disputed) / total * 0.5 + 0.5));
    return {
        isAuthentic,
        confidence,
        explanation: 'Derived from verification results of transcribed claims.',
        indicators: [],
    };
}
// Helper to calculate comprehensive scores
function calculateScores(factualClaims, authenticityAnalysis, webSources) {
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
    const trustExplainabilityScore = Math.round((sourceIntegrityScore * 0.4 + contentAuthenticityScore * 0.4 + avgConfidence * 100 * 0.2));
    return {
        sourceIntegrityScore: Math.min(100, sourceIntegrityScore),
        contentAuthenticityScore: Math.min(100, contentAuthenticityScore),
        trustExplainabilityScore: Math.min(100, trustExplainabilityScore),
    };
}
// Main analysis function
export async function analyzeAudioContent(input, options) {
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
        let webSources = [];
        try {
            const webAnalysis = await performWebAnalysis({
                query: transcription.substring(0, 500),
                contentType: 'text',
                searchEngineId: options?.searchEngineId
            });
            webSources = webAnalysis.currentInformation || [];
        }
        catch (error) {
            console.error('Web analysis failed:', error);
        }
        // Step 5: Determine analysis label based on results
        let analysisLabel = 'YELLOW';
        const verifiedClaims = factualClaims.filter(c => c.verdict === 'VERIFIED').length;
        const disputedClaims = factualClaims.filter(c => c.verdict === 'DISPUTED').length;
        const totalClaims = Math.max(1, factualClaims.length);
        if (!authenticityAnalysis.isAuthentic || disputedClaims > totalClaims * 0.5) {
            analysisLabel = 'RED';
        }
        else if (verifiedClaims === totalClaims && authenticityAnalysis.confidence > 0.7) {
            analysisLabel = 'GREEN';
        }
        else if (disputedClaims > 0 || authenticityAnalysis.confidence < 0.5) {
            analysisLabel = 'ORANGE';
        }
        // Step 6: Calculate scores
        const scores = calculateScores(factualClaims, authenticityAnalysis, (webSources?.length || 0));
        // Step 7: Gemini-driven formatting of presentation fields and sources
        const candidateSources = (webSources || []).map((s) => ({ url: s.url, title: s.title, snippet: s.snippet, relevance: s.relevance }));
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
                format: input.mimeType || 'audio/wav',
                duration: 0,
                bitrate: 0,
                transcription,
                factualClaims
            }
        };
    }
    catch (error) {
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
            }
        };
    }
}
//# sourceMappingURL=analyze-audio-content.js.map