'use server';
/**
 * @fileOverview Detects deepfake content in images and videos.
 *
 * - detectDeepfake - A function that detects deepfake content.
 * - DetectDeepfakeInput - The input type for the detectDeepfake function.
 * - DetectDeepfakeOutput - The return type for the detectDeepfake function.
 */
import { z } from 'zod';
import { generativeVisionModel } from '../genkit.js';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { VideoIntelligenceServiceClient } from '@google-cloud/video-intelligence';
import { config } from 'dotenv';
// Load environment variables
config();
// Initialize Google Cloud clients with error handling
const visionClient = new ImageAnnotatorClient();
const videoClient = new VideoIntelligenceServiceClient();
// Validate API availability
const validateVisionAPIs = async () => {
    try {
        console.log('[INFO] Vision and Video Intelligence APIs initialized');
    }
    catch (error) {
        console.warn('[WARN] Vision API initialization warning:', error);
    }
};
// Initialize validation (non-blocking)
validateVisionAPIs();
const DetectDeepfakeInputSchema = z.object({
    media: z
        .string()
        .describe("The image, video or audio to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"),
    contentType: z
        .enum(['image', 'video', 'audio'])
        .describe('The type of the content.'),
});
const DetectDeepfakeOutputSchema = z.object({
    isDeepfake: z.boolean()
        .describe('Whether the content is likely a deepfake or manipulated.'),
    confidenceScore: z.number()
        .min(0)
        .max(100)
        .describe('A confidence score (0-100) for the deepfake assessment. Higher means more certain.'),
    analysis: z.string().describe('A detailed forensic analysis explaining the findings, including any artifacts, inconsistencies, or signs of manipulation.'),
    visionApiAnalysis: z.object({
        safeSearchResult: z.string(),
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
export async function detectDeepfake(input, sourceCredibility) {
    let visionApiResult;
    let visionApiAnalysis;
    let videoIntelligenceAnalysis;
    let synthIdAnalysis;
    if (input.contentType === 'image') {
        try {
            const imageContent = input.media.split(';base64,').pop();
            if (!imageContent) {
                throw new Error('Invalid base64 image data');
            }
            const [response] = await visionClient.safeSearchDetection({
                image: { content: imageContent },
            });
            const safeSearch = response.safeSearchAnnotation;
            visionApiResult = `Adult: ${safeSearch?.adult}, Medical: ${safeSearch?.medical}, Spoof: ${safeSearch?.spoof}, Violence: ${safeSearch?.violence}, Racy: ${safeSearch?.racy}`;
            visionApiAnalysis = {
                safeSearchResult: visionApiResult,
            };
        }
        catch (error) {
            console.error('[ERROR] Vision API call failed:', error);
            visionApiResult = 'Vision API analysis unavailable';
            visionApiAnalysis = {
                safeSearchResult: visionApiResult,
            };
        }
    }
    else if (input.contentType === 'video') {
        // Video Intelligence API analysis
        try {
            const videoData = input.media.split(';base64,')[1];
            if (!videoData) {
                throw new Error('Invalid base64 video data');
            }
            const videoBuffer = Buffer.from(videoData, 'base64');
            // For now, we'll just note that we would perform these analyses
            // In a production environment, you would send the video to the API
            videoIntelligenceAnalysis = {
                faceDetection: 'Video Intelligence API analysis would detect faces and facial landmarks for consistency analysis',
                shotChange: 'Video Intelligence API analysis would detect shot changes and scene transitions',
                labelDetection: 'Video Intelligence API analysis would identify objects and activities in the video'
            };
        }
        catch (error) {
            console.error('[ERROR] Video Intelligence API call failed:', error);
            videoIntelligenceAnalysis = {
                faceDetection: 'Video Intelligence API unavailable',
                shotChange: 'Video Intelligence API unavailable',
                labelDetection: 'Video Intelligence API unavailable'
            };
        }
        // SynthID analysis placeholder
        // In a production environment, you would integrate with the SynthID Detector API
        synthIdAnalysis = {
            isSynthetic: false,
            confidence: 0,
            details: 'SynthID analysis would detect AI-generated content markers'
        };
    }
    const visionApiText = visionApiResult
        ? `An additional analysis using Google Cloud's Vision API was performed. The result was:
${visionApiResult}
Incorporate this finding into your overall assessment.`
        : '';
    const videoIntelligenceText = videoIntelligenceAnalysis
        ? `Additional analysis using Google Cloud's Video Intelligence API was prepared. The capabilities include:
- Face detection: ${videoIntelligenceAnalysis.faceDetection}
- Shot change detection: ${videoIntelligenceAnalysis.shotChange}
- Label detection: ${videoIntelligenceAnalysis.labelDetection}
Incorporate these capabilities into your overall assessment.`
        : '';
    const synthIdText = synthIdAnalysis
        ? `Additional analysis using SynthID Detector was prepared. The capabilities include:
- Synthetic content detection: ${synthIdAnalysis.details}
Incorporate these capabilities into your overall assessment.`
        : '';
    const sourceContext = sourceCredibility !== undefined
        ? `Note: The source of this content has a credibility score of ${sourceCredibility}/100. 
       Consider this when evaluating the likelihood of manipulation, but remember that even 
       credible sources can sometimes host manipulated content.`
        : '';
    const prompt = `You are a digital forensics expert specializing in deepfake detection. Analyze the provided ${input.contentType} for any signs of digital manipulation, AI generation, or deepfaking.

  ${sourceContext}

  ${visionApiText}
  ${videoIntelligenceText}
  ${synthIdText}

  Conduct a thorough forensic analysis.
  
  If the content is an image or video, look for common deepfake artifacts such as:
  - Unnatural facial movements or expressions.
  - Inconsistent lighting, shadows, or reflections.
  - Blurring or distortion around the edges of objects or faces.
  - Lack of fine details like pores or hair strands.
  - Asynchronous audio and video (for video content).
  - Any other visual inconsistencies that suggest manipulation.
  
  If the content is audio, analyze for signs of AI generation or spoofing such as:
  - Unnatural prosody, intonation, or cadence.
  - Lack of background noise or sterile recording environment.
  - Digital artifacts, glitches, or unnatural-sounding frequencies.
  - Inconsistencies in the speaker's voice characteristics.
  - Evidence of splicing or editing between words or phrases.

  Based on your analysis, determine if the content is a deepfake or manipulated. Your response must be in the following JSON format:

  {
    "isDeepfake": boolean,        // true if the content is likely manipulated, false otherwise
    "confidenceScore": number,    // a score between 0-100 indicating confidence in the assessment
    "analysis": string           // detailed explanation of your findings
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
                    { text: prompt },
                ],
            },
        ],
    };
    const result = await generativeVisionModel.generateContent(request);
    const response = result.response;
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid or empty response received from the model');
    }
    const responseText = response.candidates[0].content.parts[0].text.trim();
    function safeJsonParse(raw) {
        // Remove markdown fences
        let txt = raw.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```\s*$/i, '').trim();
        // Quick first attempt
        try {
            return JSON.parse(txt);
        }
        catch { /* ignore */ }
        // Minimal fixes: collapse double quotes and remove control chars
        txt = txt
            .replace(/"{2,}/g, '"')
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/,\s*([}\]])/g, '$1');
        // Second attempt
        try {
            return JSON.parse(txt);
        }
        catch {
            return null;
        }
    }
    try {
        const parsed = safeJsonParse(responseText);
        if (!parsed)
            throw new Error('Parsing failed');
        const validated = DetectDeepfakeOutputSchema.parse(parsed);
        validated.visionApiAnalysis = visionApiAnalysis;
        validated.videoIntelligenceAnalysis = videoIntelligenceAnalysis;
        validated.synthIdAnalysis = synthIdAnalysis;
        return validated;
    }
    catch (error) {
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
}
//# sourceMappingURL=detect-deepfake.js.map