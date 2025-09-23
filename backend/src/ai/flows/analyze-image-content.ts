import { z } from 'zod';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { performWebAnalysis } from './perform-web-analysis.js';
import { formatUnifiedPresentation } from './format-unified-presentation.js';
import { detectDeepfake } from './detect-deepfake.js';
import { groundedModel } from '../genkit.js';

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
  }).optional(),
});
export type ImageAnalysisOutput = z.infer<typeof ImageAnalysisOutputSchema>;

// Helper to extract image metadata using Google Vision API
async function extractImageMetadata(imageData: string) {
  const client = new ImageAnnotatorClient();
  const request = {
    image: { content: imageData.includes('base64') ? Buffer.from(imageData.split(',')[1], 'base64') : imageData },
    features: [{ type: 'IMAGE_PROPERTIES' }],
  };

  try {
    const [result] = await client.annotateImage(request);
    return {
      location: result.landmarkAnnotations?.[0]?.description || 'Unknown',
      other: result.imagePropertiesAnnotation || {},
    };
  } catch (error) {
    console.error('Vision API error:', error);
    return {
      location: 'Unknown',
      other: { error: 'Metadata extraction failed' },
    };
  }
}

// Helper to perform OCR on image
async function performOcr(imageData: string) {
  const client = new ImageAnnotatorClient();
  const request = {
    image: { content: imageData.includes('base64') ? Buffer.from(imageData.split(',')[1], 'base64') : imageData },
    features: [{ type: 'TEXT_DETECTION' }],
  };

  try {
    const [result] = await client.annotateImage(request);
    return result.fullTextAnnotation?.text || '';
  } catch (error) {
    console.error('OCR error:', error);
    return '';
  }
}

// Helper to analyze image content and extract claims from OCR (heuristic; no LLM)
async function analyzeImageContentAndFactCheck(
  imageData: string,
  ocrText: string
): Promise<{ description: string; factualClaims: Array<{ claim: string; verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED'; confidence: number; }> }> {
  const description = ocrText ? `Image with readable text (~${Math.min(ocrText.length, 500)} chars).` : 'Image content analyzed (no readable text detected).';
  const sentences = (ocrText || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[\.!\?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  const factualRegex = /(\bis\b|\bare\b|\bwas\b|\bwere\b|\bhas\b|\bhave\b|\bclaims?\b|\breports?\b|\baccording to\b|\bpercent|\b\d{4}\b)/i;
  const candidateClaims = Array.from(new Set(sentences.filter(s => s.length > 20 && factualRegex.test(s)))).slice(0, 5);
  const factualClaims: Array<{ claim: string; verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIED'; confidence: number; }> = [];
  // We defer fact-checking to text/video/audio analyzers; image analyzer will present claims context via presentation
  // to avoid over-calling fact-check API on noisy OCR. Keep empty or minimal claims.
  for (const c of candidateClaims) {
    factualClaims.push({ claim: c, verdict: 'UNVERIFIED', confidence: 0.4 });
  }
  return { description, factualClaims };
}

// Basic placeholder when dedicated deepfake API is unavailable (no LLM)
async function detectImageDeepfake(imageData: string) {
    const prompt = `Analyze this image for signs of deepfake or manipulation. Provide a boolean (true/false) if manipulated, a confidence score (0-1), and a detailed explanation.`;
  
    const result = await groundedModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
      tools: [{googleSearch: {}}],
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
export async function analyzeImageContent(input: ImageAnalysisInput): Promise<ImageAnalysisOutput> {
  try {
    // Run metadata, OCR, deepfake detection, and reverse image search concurrently
    const metadataPromise = extractImageMetadata(input.imageData);
    const ocrPromise = performOcr(input.imageData);
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

    const [metadata, ocrText, deepfakeInfo] = await Promise.all([
      metadataPromise,
      ocrPromise,
      deepfakePromise,
    ]);

    // Analyze content and fact-check (requires OCR text if any)
    const contentAnalysis = await analyzeImageContentAndFactCheck(input.imageData, ocrText);
    const isManipulated = deepfakeInfo.isManipulated;
    const manipulationConfidence = deepfakeInfo.manipulationConfidence;

    // Step 5: Web analysis for context
    let webSources: any[] = [];
    if (ocrText) {
      try {
        const webAnalysis = await performWebAnalysis({
          query: ocrText.substring(0, 500),
          contentType: 'text'
        });
        webSources = webAnalysis.currentInformation || [];
      } catch (error) {
        console.error('Web analysis failed:', error);
      }
    }

    // Step 6: Determine analysis label
    let analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN' = 'YELLOW';
    if (isManipulated && manipulationConfidence > 0.7) {
      analysisLabel = 'RED';
    } else if (!isManipulated && contentAnalysis.factualClaims.every((c: any) => c.verdict === 'VERIFIED')) {
      analysisLabel = 'GREEN';
    } else if (contentAnalysis.factualClaims.some((c: any) => c.verdict === 'DISPUTED')) {
      analysisLabel = 'ORANGE';
    }

    // Step 7: Calculate scores
    const scores = calculateScores(contentAnalysis, { isManipulated, confidence: manipulationConfidence });

    // Step 8: Gemini-driven formatting of presentation fields and sources
    const candidateSources = [
      ...(webSources || []).map((s: any) => ({ url: s.url, title: s.title, snippet: s.snippet, relevance: s.relevance }))
    ];
    const presentation = await formatUnifiedPresentation({
      contentType: 'image',
      analysisLabel,
      rawSignals: {
        description: contentAnalysis.description,
        factualClaims: contentAnalysis.factualClaims,
        isManipulated,
        manipulationConfidence,
        ocrText,
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
        ocrText,
        description: contentAnalysis.description,
        isManipulated
      }
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
      metadata: {}
    };
  }
}
