'use server';
/**
 * @fileOverview Detects deepfake content in images and videos using Gemini API and GCP Vision APIs.
 *
 * - detectDeepfake - A function that detects deepfake content.
 * - DetectDeepfakeInput - The input type for the detectDeepfake function.
 * - DetectDeepfakeOutput - The return type for the detectDeepfake function.
 */

import { z } from 'zod';
import { generativeVisionModel } from '../genkit.js';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { VideoIntelligenceServiceClient } from '@google-cloud/video-intelligence';
import { getAuthConfig, getProjectId } from '../auth.js';

const DetectDeepfakeInputSchema = z.object({
  media: z
    .string()
    .describe(
      "The image, video or audio to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'")
  ,
  contentType: z
    .enum(['image', 'video', 'audio'])
    .describe('The type of content.'),
});
export type DetectDeepfakeInput = z.infer<typeof DetectDeepfakeInputSchema>;

const DetectDeepfakeOutputSchema = z.object({
  isDeepfake:
    z.boolean()
    .describe('Whether the content is likely a deepfake or manipulated.'),
  confidenceScore:
    z.number()
    .min(0)
    .max(100)
    .describe(
      'A confidence score (0-100) for the deepfake assessment. Higher means more certain.'
    ),
  analysis:
    z.string().describe(
      'A detailed forensic analysis explaining the findings, including any artifacts, inconsistencies, or signs of manipulation.'
    ),
  visionApiAnalysis: z.object({
    safeSearchResult: z.string(),
    faceAnnotations: z.array(z.object({
      joyLikelihood: z.string().optional(),
      sorrowLikelihood: z.string().optional(),
      angerLikelihood: z.string().optional(),
      surpriseLikelihood: z.string().optional(),
      underExposedLikelihood: z.string().optional(),
      blurredLikelihood: z.string().optional(),
      headwearLikelihood: z.string().optional(),
    })).optional(),
    imageProperties: z.object({
      dominantColors: z.array(z.object({
        color: z.object({ red: z.number(), green: z.number(), blue: z.number() }),
        score: z.number(),
        pixelFraction: z.number(),
      })).optional(),
    }).optional(),
  }).optional().describe('Analysis from the Vision API.'),
  videoIntelligenceAnalysis: z.object({
    faceDetection: z.string(),
    shotChange: z.string(),
    labelDetection: z.string(),
  }).optional().describe('Analysis from the Video Intelligence API.'),
  synthIdAnalysis: z.object({
    isSynthetic: z.boolean(),
    confidence: z.number().min(0).max(100),
    details: z.string(),
  }).optional().describe('Analysis from SynthID Detector (when available).'),
});
export type DetectDeepfakeOutput = z.infer<typeof DetectDeepfakeOutputSchema>;

// Initialize GCP clients
function getVisionClient() {
  return new ImageAnnotatorClient(getAuthConfig());
}

function getVideoClient() {
  return new VideoIntelligenceServiceClient(getAuthConfig());
}

/**
 * Extracts the base64 data and MIME type from a data URI
 */
function extractImageData(dataUri: string): { mimeType: string; base64Data: string } {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URI format');
  }
  return {
    mimeType: matches[1],
    base64Data: matches[2],
  };
}

/**
 * Analyzes image using Google Cloud Vision API
 */
async function analyzeImageWithVisionAPI(imageData: string): Promise<any> {
  try {
    const client = getVisionClient();
    const { base64Data } = extractImageData(imageData);
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Perform safe search detection
    const [safeSearchResult] = await client.safeSearchDetection({ image: { content: imageBuffer } });
    
    // Perform face detection
    const [faceDetection] = await client.faceDetection({ image: { content: imageBuffer } });
    
    // Perform image properties detection
    const [imageProperties] = await client.imageProperties({ image: { content: imageBuffer } });

    return {
      safeSearchResult,
      faceDetection,
      imageProperties,
    };
  } catch (error) {
    console.error('[ERROR] Vision API analysis failed:', error);
    return null;
  }
}

/**
 * Analyzes video using Google Cloud Video Intelligence API
 */
async function analyzeVideoWithVideoIntelligenceAPI(videoData: string): Promise<any> {
  try {
    const client = getVideoClient();
    const { mimeType, base64Data } = extractImageData(videoData);
    const videoBuffer = Buffer.from(base64Data, 'base64');
    const videoBytes = videoBuffer.toString('base64');

    // Perform label detection and shot change detection
    // Video Intelligence API expects inputContent as base64 string directly
    const [operation] = await client.annotateVideo({
      features: ['LABEL_DETECTION' as any, 'SHOT_CHANGE_DETECTION' as any],
      inputContent: videoBytes, // Pass base64 string directly, not wrapped in object
      mimeType: mimeType,
    } as any);

    // Wait for the operation to complete and get results
    const [response] = await operation.promise();
    const results = (response as any)?.annotationResults;

    return {
      labelDetection: results?.labelAnnotations || [],
      shotChanges: results?.shotAnnotations || [],
    };
  } catch (error) {
    console.error('[ERROR] Video Intelligence API analysis failed:', error);
    return null;
  }
}

export async function detectDeepfake(
  input: DetectDeepfakeInput,
  sourceCredibility?: number
): Promise<DetectDeepfakeOutput> {
  // Validate image data for images
  if (input.contentType === 'image') {
    console.log('[INFO] Validating image data for deepfake analysis');
    try {
      const parts = input.media.split(';base64,');
      if (parts.length !== 2) {
        throw new Error('Invalid image data format');
      }
      const base64Data = parts[1];
      if (!base64Data || base64Data.length < 100) {
        throw new Error('Image data too small or invalid');
      }
      // Validate base64 decoding
      Buffer.from(base64Data, 'base64');
    } catch (error) {
      console.warn('[WARN] Invalid image data:', error);
      return {
        isDeepfake: false,
        confidenceScore: 0,
        analysis: 'Invalid image data format provided. Unable to perform deepfake analysis.',
        visionApiAnalysis: { safeSearchResult: 'Invalid image data', faceAnnotations: [] },
      };
    }
  }

  let visionApiResult: any = null;
  let videoIntelligenceResult: any = null;
  let visionApiAnalysis;
  let videoIntelligenceAnalysis;
  let synthIdAnalysis;

  if (input.contentType === 'image') {
    // Use Google Cloud Vision API for image analysis
    console.log('[INFO] Using Google Cloud Vision API for deepfake detection');

    try {
      visionApiResult = await analyzeImageWithVisionAPI(input.media);
      
      if (visionApiResult) {
        const { safeSearchResult, faceDetection, imageProperties } = visionApiResult;
        
        visionApiAnalysis = {
          safeSearchResult: JSON.stringify({
            adult: safeSearchResult?.adult,
            spoof: safeSearchResult?.spoof,
            medical: safeSearchResult?.medical,
            violence: safeSearchResult?.violence,
            racy: safeSearchResult?.racy,
          }),
          faceAnnotations: faceDetection?.faceAnnotations?.map((face: any) => ({
            joyLikelihood: face.joyLikelihood,
            sorrowLikelihood: face.sorrowLikelihood,
            angerLikelihood: face.angerLikelihood,
            surpriseLikelihood: face.surpriseLikelihood,
            underExposedLikelihood: face.underExposedLikelihood,
            blurredLikelihood: face.blurredLikelihood,
            headwearLikelihood: face.headwearLikelihood,
          })) || [],
          imageProperties: imageProperties?.imagePropertiesAnnotation ? {
            dominantColors: imageProperties.imagePropertiesAnnotation.dominantColors?.colors?.map((c: any) => ({
              color: c.color || { red: 0, green: 0, blue: 0 },
              score: c.score || 0,
              pixelFraction: c.pixelFraction || 0,
            })) || [],
          } : undefined,
        };
      }
    } catch (error) {
      console.error('[ERROR] Vision API call failed:', error);
      visionApiAnalysis = {
        safeSearchResult: 'Vision API analysis unavailable',
        faceAnnotations: [],
      };
    }
  } else if (input.contentType === 'video') {
    // Use Google Cloud Video Intelligence API for video analysis
    console.log('[INFO] Using Google Cloud Video Intelligence API for video analysis');

    try {
      videoIntelligenceResult = await analyzeVideoWithVideoIntelligenceAPI(input.media);
      
      if (videoIntelligenceResult) {
        const { labelDetection, shotChanges } = videoIntelligenceResult;
        
        videoIntelligenceAnalysis = {
          faceDetection: `Analyzed ${labelDetection?.length || 0} label annotations`,
          shotChange: `Detected ${shotChanges?.length || 0} shot changes`,
          labelDetection: labelDetection?.map((label: any) => label.description).join(', ') || 'No labels detected',
        };
      }
    } catch (error) {
      console.error('[ERROR] Video Intelligence API call failed:', error);
      videoIntelligenceAnalysis = {
        faceDetection: 'Video Intelligence API analysis unavailable',
        shotChange: 'Analysis unavailable',
        labelDetection: 'Analysis unavailable',
      };
    }

    // SynthID analysis placeholder
    synthIdAnalysis = {
      isSynthetic: false,
      confidence: 0,
      details: 'SynthID analysis not available'
    };
  }

  // Build context from API results
  const visionApiText = visionApiAnalysis && visionApiAnalysis.safeSearchResult !== 'Vision API analysis unavailable'
    ? `Google Cloud Vision API analysis: ${visionApiAnalysis.safeSearchResult}`
    : '';

  const videoIntelligenceText = videoIntelligenceAnalysis && videoIntelligenceAnalysis.faceDetection !== 'Video Intelligence API analysis unavailable'
    ? `Google Cloud Video Intelligence API: Face detection - ${videoIntelligenceAnalysis.faceDetection}, Shot changes - ${videoIntelligenceAnalysis.shotChange}, Labels - ${videoIntelligenceAnalysis.labelDetection}`
    : '';

  const sourceContext = sourceCredibility !== undefined
    ? `Note: The source of this content has a credibility score of ${sourceCredibility}/100.`
    : '';

  const prompt = `You are a digital forensics expert specializing in deepfake detection. Analyze the provided ${input.contentType} for any signs of digital manipulation, AI generation, or deepfaking.

  ${sourceContext}

  ${visionApiText ? `\n${visionApiText}` : ''}
  ${videoIntelligenceText ? `\n${videoIntelligenceText}` : ''}

  Conduct a thorough forensic analysis.

  ${input.contentType === 'image' || input.contentType === 'video' ? `Look for common deepfake artifacts such as:
  - Unnatural facial movements or expressions.
  - Inconsistent lighting, shadows, or reflections.
  - Blurring or distortion around the edges of objects or faces.
  - Lack of fine details like pores or hair strands.
  - Asynchronous audio and video (for video content).
  - Any other visual inconsistencies that suggest manipulation.` : ''}

  ${input.contentType === 'audio' ? `Analyze for signs of AI generation or spoofing such as:
  - Unnatural prosody, intonation, or cadence.
  - Lack of background noise or sterile recording environment.
  - Digital artifacts, glitches, or unnatural-sounding frequencies.
  - Inconsistencies in the speaker's voice characteristics.
  - Evidence of splicing or editing between words or phrases.` : ''}

  Based on your analysis, determine if the content is a deepfake or manipulated. Your response must be in the following JSON format:

  {
    "isDeepfake": boolean,
    "confidenceScore": number,
    "analysis": string
  }

  Example response:
  {
    "isDeepfake": true,
    "confidenceScore": 85,
    "analysis": "The image shows clear signs of manipulation, including inconsistent lighting..."
  }`;

  const [mimeType, base64Data] = input.media.split(';base64,');

  const request = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType.replace('data:', ''),
              data: base64Data,
            },
          },
          {text: prompt},
        ],
      },
    ],
  };

  try {
    const result = await generativeVisionModel.generateContent(request);
    const response = result.response;

    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid or empty response received from the model');
    }

    const responseText = response.candidates[0].content.parts[0].text.trim();

    function safeJsonParse(raw: string): any | null {
      let txt = raw.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
      try {
        return JSON.parse(txt);
      } catch { /* ignore */ }
      txt = txt
        .replace(/"{2,}/g, '"')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/,\s*([}\]])/g, '$1');
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    }

    try {
      const parsed = safeJsonParse(responseText);
      if (!parsed) throw new Error('Parsing failed');
      const validated = DetectDeepfakeOutputSchema.parse(parsed as any);
      validated.visionApiAnalysis = visionApiAnalysis;
      validated.videoIntelligenceAnalysis = videoIntelligenceAnalysis;
      validated.synthIdAnalysis = synthIdAnalysis;
      return validated;
    } catch (error) {
      console.error('[ERROR] Error parsing or validating model output:', error);
      return {
        isDeepfake: false,
        confidenceScore: 0,
        analysis: 'The model returned a response that was not valid JSON.',
        visionApiAnalysis,
        videoIntelligenceAnalysis,
        synthIdAnalysis,
      };
    }
  } catch (modelError) {
    console.error('[ERROR] Model call failed:', modelError);
    return {
      isDeepfake: false,
      confidenceScore: 0,
      analysis: 'Deepfake analysis unavailable due to API error.',
      visionApiAnalysis,
      videoIntelligenceAnalysis,
      synthIdAnalysis,
    };
  }
}
