import { z } from 'zod';
import { groundedModel, generativeVisionModel } from '../genkit.js';
import { v1 as videoIntelligence, protos as viProtos } from '@google-cloud/video-intelligence';
import { performWebAnalysis } from './perform-web-analysis.js';
import { formatUnifiedPresentation } from './format-unified-presentation.js';
import { detectDeepfake } from './detect-deepfake.js';
const VideoAnalysisInputSchema = z.object({
    videoData: z.string().min(1, 'Video data is required'), // Base64 or GCS URL
    mimeType: z.string().optional(),
});
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
});
// Helper to extract video metadata using Video Intelligence API (kept as primary metadata source)
async function extractVideoMetadata(videoData) {
    const client = new videoIntelligence.VideoIntelligenceServiceClient();
    const request = {
        inputUri: videoData.startsWith('gs://') ? videoData : undefined,
        inputContent: videoData.startsWith('data:') ? Buffer.from(videoData.split(',')[1], 'base64') : undefined,
        features: [viProtos.google.cloud.videointelligence.v1.Feature.LABEL_DETECTION],
    };
    try {
        const [operation] = await client.annotateVideo(request);
        const [result] = await operation.promise();
        return {
            location: result.annotationResults?.[0]?.segmentLabelAnnotations?.[0]?.entity?.description || 'Unknown',
            technicalData: { inputUri: result.annotationResults?.[0]?.inputUri || 'Unknown' },
        };
    }
    catch (error) {
        console.error('Video Intelligence metadata error:', error);
        return {
            location: 'Unknown',
            technicalData: { error: 'Metadata extraction failed' },
        };
    }
}
// Helper for speech + labels using Video Intelligence API (primary for transcription/events)
async function analyzeVideoIntelligence(videoData) {
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
    };
    try {
        const [operation] = await client.annotateVideo(request);
        const [result] = await operation.promise();
        const transcription = result.annotationResults?.[0]?.speechTranscriptions?.[0]?.alternatives?.[0]?.transcript || '';
        const events = result.annotationResults?.[0]?.segmentLabelAnnotations?.map(a => a.entity?.description || 'Unknown event') || [];
        return {
            events,
            transcription,
            keyFrames: [],
        };
    }
    catch (error) {
        console.error('Video Intelligence analysis error:', error);
        return {
            events: [],
            transcription: '',
            keyFrames: [],
        };
    }
}
// Build a file part for Gemini/Vertex AI based on the provided video data
function buildVideoPart(videoData, mimeType) {
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
function tryParseJsonLoose(text) {
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
        }
        catch {
            // Attempt to remove trailing commas
            const noTrailingCommas = candidate.replace(/,(\s*[}\]])/g, '$1');
            return JSON.parse(noTrailingCommas);
        }
    }
    catch (e) {
        return null;
    }
}
// Gemini-based comprehensive video understanding
async function geminiVideoUnderstanding(videoData, mimeType) {
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
                        filePart,
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
                events: Array.isArray(parsed.events) ? parsed.events.map((e) => String(e)) : [],
            };
        }
    }
    catch (e) {
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
async function getShotChangeTimestamps(videoData) {
    const client = new videoIntelligence.VideoIntelligenceServiceClient();
    const request = {
        inputUri: videoData.startsWith('gs://') ? videoData : undefined,
        inputContent: videoData.startsWith('data:') ? Buffer.from(videoData.split(',')[1], 'base64') : undefined,
        features: [viProtos.google.cloud.videointelligence.v1.Feature.SHOT_CHANGE_DETECTION],
    };
    try {
        const [operation] = await client.annotateVideo(request);
        const [result] = await operation.promise();
        const shots = result.annotationResults?.[0]?.shotAnnotations || [];
        return shots.slice(0, 10).map((s) => {
            const start = Number(s.startTimeOffset?.seconds || 0) + Number(s.startTimeOffset?.nanos || 0) / 1e9;
            const end = Number(s.endTimeOffset?.seconds || 0) + Number(s.endTimeOffset?.nanos || 0) / 1e9;
            return { startSec: Math.max(0, Math.floor(start)), endSec: Math.max(0, Math.ceil(end)) };
        });
    }
    catch (e) {
        console.warn('[WARN] Shot change detection failed:', e);
        return [];
    }
}
// Build reverse search queries from understanding + transcription + shot info
function buildReverseSearchQueries(understanding, transcription, shotSpans) {
    const queries = [];
    const texts = (understanding?.contextualInfo?.recognizedText || []).slice(0, 3);
    const brands = (understanding?.contextualInfo?.brands || []).slice(0, 2);
    const logos = (understanding?.contextualInfo?.logos || []).slice(0, 2);
    const locations = (understanding?.contextualInfo?.locations || []).slice(0, 2);
    const events = (understanding?.events || []).slice(0, 2);
    if (texts.length)
        queries.push(texts.join(' '));
    if (brands.length)
        queries.push(brands.join(' '));
    if (logos.length)
        queries.push(logos.join(' '));
    if (locations.length)
        queries.push(locations.join(' '));
    if (events.length)
        queries.push(events.join(' '));
    if (transcription) {
        queries.push(transcription.slice(0, 120));
    }
    if (understanding?.contentDescription) {
        queries.push(understanding.contentDescription.slice(0, 120));
    }
    if (shotSpans.length) {
        const s0 = shotSpans[0];
        queries.push(`video scene ${s0.startSec}-${s0.endSec} analysis`);
    }
    // Deduplicate and return top few
    const seen = new Set();
    const deduped = queries.filter(q => {
        const key = q.toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return q.trim().length > 0;
    });
    return deduped.slice(0, 4);
}
// Run performWebAnalysis for each query and aggregate currentInformation items
async function reverseWebGrounding(queries, searchEngineId) {
    const results = [];
    for (const q of queries) {
        try {
            const r = await performWebAnalysis({ query: q, contentType: 'text', searchEngineId });
            if (Array.isArray(r?.currentInformation)) {
                results.push(...r.currentInformation);
            }
        }
        catch (e) {
            console.warn('[WARN] reverseWebGrounding query failed:', q, e);
        }
    }
    // Deduplicate by URL
    const byUrl = new Map();
    for (const item of results) {
        if (item?.url && !byUrl.has(item.url))
            byUrl.set(item.url, item);
    }
    return Array.from(byUrl.values()).slice(0, 12);
}
// Helper to fact-check video content
async function analyzeVideoContentAndFactCheck(videoData, transcription) {
    const prompt = transcription
        ? `Fact-check the content of this video, including transcribed audio: "${transcription}". List factual claims with verdict (VERIFIED, DISPUTED, UNVERIFIED) and confidence (0-1).`
        : `Fact-check the content of this video. List factual claims with verdict (VERIFIED, DISPUTED, UNVERIFIED) and confidence (0-1).`;
    const result = await groundedModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
    });
    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const claimsRegex = /Claim: "(.*?)"\s*Verdict: (VERIFIED|DISPUTED|UNVERIFIED)\s*Confidence: (\d\.\d+)/g;
    const factualClaims = [];
    let match;
    while ((match = claimsRegex.exec(responseText)) !== null) {
        factualClaims.push({
            claim: match[1],
            verdict: match[2],
            confidence: parseFloat(match[3]),
        });
    }
    return { factualClaims };
}
// Helper for deepfake detection using Gemini vision with structured JSON
async function detectVideoDeepfake(videoData, mimeType) {
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
                    parts: [{ text: prompt }, filePart],
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
    }
    catch (e) {
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
function calculateScores(contentAnalysis, manipulationAnalysis) {
    const verifiedClaims = contentAnalysis.factualClaims.filter((c) => c.verdict === 'VERIFIED').length;
    const totalClaims = Math.max(1, contentAnalysis.factualClaims.length);
    const disputedClaims = contentAnalysis.factualClaims.filter((c) => c.verdict === 'DISPUTED').length;
    // Source Integrity Score
    const verificationRate = verifiedClaims / totalClaims;
    const sourceIntegrityScore = Math.round(verificationRate * 100);
    // Content Authenticity Score
    const baseAuthenticity = manipulationAnalysis.isManipulated ? 20 : 80;
    const confidenceBoost = manipulationAnalysis.confidence * 20;
    const disputePenalty = (disputedClaims / totalClaims) * 30;
    const contentAuthenticityScore = Math.round(Math.max(0, baseAuthenticity + confidenceBoost - disputePenalty));
    // Trust Explainability Score
    const avgConfidence = contentAnalysis.factualClaims.reduce((sum, c) => sum + c.confidence, 0) / totalClaims;
    const trustExplainabilityScore = Math.round((sourceIntegrityScore * 0.3 + contentAuthenticityScore * 0.4 + avgConfidence * 100 * 0.3));
    return {
        sourceIntegrityScore: Math.min(100, sourceIntegrityScore),
        contentAuthenticityScore: Math.min(100, contentAuthenticityScore),
        trustExplainabilityScore: Math.min(100, trustExplainabilityScore),
    };
}
// Main analysis function
export async function analyzeVideoContent(input, options) {
    try {
        // Placeholder for GCS upload function
        // if (!input.videoData.startsWith('gs://') && !input.videoData.startsWith('data:')) {
        //   input.videoData = await uploadToGcs(input.videoData);
        // }
        // Run Video Intelligence (metadata + transcription), Gemini understanding, and deepfake detection concurrently
        const metadataPromise = extractVideoMetadata(input.videoData);
        const intelligencePromise = analyzeVideoIntelligence(input.videoData);
        const understandingPromise = geminiVideoUnderstanding(input.videoData, input.mimeType);
        const deepfakePromise = (async () => {
            try {
                const deepfakeResult = await detectDeepfake({ media: input.videoData, contentType: 'video' });
                return { isManipulated: deepfakeResult.isDeepfake, manipulationConfidence: deepfakeResult.confidenceScore / 100 };
            }
            catch (error) {
                console.error('Deepfake detection failed:', error);
                const basicResult = await detectVideoDeepfake(input.videoData, input.mimeType);
                return { isManipulated: basicResult.isManipulated, manipulationConfidence: basicResult.confidence };
            }
        })();
        const [metadataVI, intelligenceAnalysis, understanding, deepfakeInfo] = await Promise.all([
            metadataPromise,
            intelligencePromise,
            understandingPromise,
            deepfakePromise,
        ]);
        // Use VI outputs as primary for transcription/events and metadata; augment only in rawSignals later
        const metadata = {
            location: metadataVI?.location || 'Unknown',
            transcription: intelligenceAnalysis?.transcription || '',
            events: intelligenceAnalysis?.events || [],
            isManipulated: deepfakeInfo.isManipulated,
            technicalData: metadataVI?.technicalData,
        };
        // Fact-check after transcription is available
        const contentAnalysis = await analyzeVideoContentAndFactCheck(input.videoData, intelligenceAnalysis.transcription);
        const isManipulated = deepfakeInfo.isManipulated;
        const manipulationConfidence = deepfakeInfo.manipulationConfidence;
        // Step 5: Web analysis for context
        let webSources = [];
        if (intelligenceAnalysis.transcription) {
            try {
                const webAnalysis = await performWebAnalysis({
                    query: intelligenceAnalysis.transcription.substring(0, 500),
                    contentType: 'text',
                    searchEngineId: options?.searchEngineId
                });
                webSources = webAnalysis.currentInformation || [];
            }
            catch (error) {
                console.error('Web analysis failed:', error);
            }
        }
        // Reverse source tracking via shot boundaries + semantic queries (Gemini & VI)
        try {
            const shotSpans = await getShotChangeTimestamps(input.videoData);
            const queries = buildReverseSearchQueries(understanding, intelligenceAnalysis.transcription, shotSpans);
            if (queries.length > 0) {
                const reverseSources = await reverseWebGrounding(queries, options?.searchEngineId);
                if (Array.isArray(reverseSources) && reverseSources.length > 0) {
                    const byUrl = new Map();
                    for (const s of webSources)
                        if (s?.url)
                            byUrl.set(s.url, s);
                    for (const s of reverseSources)
                        if (s?.url && !byUrl.has(s.url))
                            byUrl.set(s.url, s);
                    webSources = Array.from(byUrl.values());
                }
            }
        }
        catch (e) {
            console.warn('[WARN] Reverse source tracking failed:', e);
        }
        // Step 6: Determine analysis label
        let analysisLabel = 'YELLOW';
        const verifiedClaims = contentAnalysis.factualClaims.filter((c) => c.verdict === 'VERIFIED').length;
        const disputedClaims = contentAnalysis.factualClaims.filter((c) => c.verdict === 'DISPUTED').length;
        const totalClaims = Math.max(1, contentAnalysis.factualClaims.length);
        if (isManipulated && manipulationConfidence > 0.7) {
            analysisLabel = 'RED';
        }
        else if (verifiedClaims === totalClaims && !isManipulated) {
            analysisLabel = 'GREEN';
        }
        else if (disputedClaims > 0 || (isManipulated && manipulationConfidence > 0.5)) {
            analysisLabel = 'ORANGE';
        }
        // Step 7: Calculate scores
        const scores = calculateScores(contentAnalysis, { isManipulated, confidence: manipulationConfidence });
        // Step 8: Gemini-driven formatting of presentation fields and sources
        const candidateSources = (webSources || []).map((s) => ({ url: s.url, title: s.title, snippet: s.snippet, relevance: s.relevance }));
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
                location: metadata.location,
                transcription: intelligenceAnalysis.transcription,
                events: intelligenceAnalysis.events,
                isManipulated,
                technicalData: metadata.technicalData,
            }
        };
    }
    catch (error) {
        console.error('Error in video analysis:', error);
        // Return error response with proper format
        return {
            analysisLabel: 'RED',
            oneLineDescription: 'Video analysis encountered an error',
            summary: 'The video analysis could not be completed due to technical issues. Please verify the video format and try again.',
            educationalInsight: 'When video analysis fails, use manual verification methods like checking the source, looking for visual inconsistencies, and using alternative deepfake detection tools.',
            sources: [
                { url: 'https://deepware.ai/', title: 'Deepware AI Detection', credibility: 0.88 }
            ],
            sourceIntegrityScore: 0,
            contentAuthenticityScore: 0,
            trustExplainabilityScore: 0,
            metadata: {}
        };
    }
}
//# sourceMappingURL=analyze-video-content.js.map