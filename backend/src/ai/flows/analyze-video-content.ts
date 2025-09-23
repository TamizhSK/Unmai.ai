import { z } from 'zod';
import { groundedModel } from '../genkit.js';
import { v1 as videoIntelligence, protos as viProtos } from '@google-cloud/video-intelligence';
import { performWebAnalysis } from './perform-web-analysis.js';
import { formatUnifiedPresentation } from './format-unified-presentation.js';
import { detectDeepfake } from './detect-deepfake.js';
import { factCheckClaim } from './fact-check-claim.js';

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
  }).optional(),
});
export type VideoAnalysisOutput = z.infer<typeof VideoAnalysisOutputSchema>;

// Helper to extract video metadata using Video Intelligence API
async function extractVideoMetadata(videoData: string) {
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
      technicalData: { duration: result.annotationResults?.[0]?.inputUri || 'Unknown' },
    };
  } catch (error) {
    console.error('Video Intelligence metadata error:', error);
    return {
      location: 'Unknown',
      technicalData: { error: 'Metadata extraction failed' },
    };
  }
}

// Helper for video intelligence analysis
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
  };

  try {
    const [operation] = await client.annotateVideo(request);
    const [result] = await operation.promise();
    const transcription = result.annotationResults?.[0]?.speechTranscriptions?.[0]?.alternatives?.[0]?.transcript || '';
    const events = result.annotationResults?.[0]?.segmentLabelAnnotations?.map(a => a.entity?.description || 'Unknown event') || [];
    return {
      events,
      transcription,
      keyFrames: ['Placeholder keyframe'],
    };
  } catch (error) {
    console.error('Video Intelligence analysis error:', error);
    return {
      events: [],
      transcription: '',
      keyFrames: [],
    };
  }
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

// Helper for deepfake detection
async function detectVideoDeepfake(videoData: string) {
  const prompt = `Analyze this video for signs of deepfake or manipulation. Provide a boolean (true/false) if manipulated, a confidence score (0-1), and a detailed explanation.`;
  
  const result = await groundedModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1 },
  });
  
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const confidenceRegex = /Confidence: (\d\.\d+)/;
  const confidenceMatch = responseText.match(confidenceRegex);
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;

  return {
    isManipulated: responseText.includes('Manipulated: true'),
    confidence: confidence,
    explanation: responseText.split('Explanation:')[1] || 'Analysis not conclusive.',
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
export async function analyzeVideoContent(input: VideoAnalysisInput): Promise<VideoAnalysisOutput> {
  try {
    // Placeholder for GCS upload function
    // if (!input.videoData.startsWith('gs://') && !input.videoData.startsWith('data:')) {
    //   input.videoData = await uploadToGcs(input.videoData);
    // }

    // Run metadata extraction, video intelligence, and deepfake detection concurrently
    const metadataPromise = extractVideoMetadata(input.videoData);
    const intelligencePromise = analyzeVideoIntelligence(input.videoData);
    const deepfakePromise = (async () => {
      try {
        const deepfakeResult = await detectDeepfake({ media: input.videoData, contentType: 'video' });
        return { isManipulated: deepfakeResult.isDeepfake, manipulationConfidence: deepfakeResult.confidenceScore / 100 };
      } catch (error) {
        console.error('Deepfake detection failed:', error);
        const basicResult = await detectVideoDeepfake(input.videoData);
        return { isManipulated: basicResult.isManipulated, manipulationConfidence: basicResult.confidence };
      }
    })();

    const [metadata, intelligenceAnalysis, deepfakeInfo] = await Promise.all([
      metadataPromise,
      intelligencePromise,
      deepfakePromise
    ]);

    // Fact-check after transcription is available
    const contentAnalysis = await analyzeVideoContentAndFactCheck(input.videoData, intelligenceAnalysis.transcription);
    const isManipulated = deepfakeInfo.isManipulated;
    const manipulationConfidence = deepfakeInfo.manipulationConfidence;

    // Step 5: Web analysis for context
    let webSources: any[] = [];
    if (intelligenceAnalysis.transcription) {
      try {
        const webAnalysis = await performWebAnalysis({
          query: intelligenceAnalysis.transcription.substring(0, 500),
          contentType: 'text'
        });
        webSources = webAnalysis.currentInformation || [];
      } catch (error) {
        console.error('Web analysis failed:', error);
      }
    }

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

    // Step 7: Calculate scores
    const scores = calculateScores(contentAnalysis, { isManipulated, confidence: manipulationConfidence });

    // Step 8: Gemini-driven formatting of presentation fields and sources
    const candidateSources = (webSources || []).map((s: any) => ({ url: s.url, title: s.title, snippet: s.snippet, relevance: s.relevance }));
    const presentation = await formatUnifiedPresentation({
      contentType: 'video',
      analysisLabel,
      rawSignals: {
        transcription: intelligenceAnalysis.transcription,
        events: intelligenceAnalysis.events,
        factualClaims: contentAnalysis.factualClaims,
        isManipulated,
        manipulationConfidence,
        metadata
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
        location: metadata.location,
        transcription: intelligenceAnalysis.transcription,
        events: intelligenceAnalysis.events,
        isManipulated
      }
    };
  } catch (error) {
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
