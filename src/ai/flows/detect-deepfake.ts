'use server';
/**
 * @fileOverview AI agent to detect deepfakes in images, videos and audio.
 *
 * - detectDeepfake - A function that handles the deepfake detection process.
 * - DetectDeepfakeInput - The input type for the detectDeepfake function.
 * - DetectDeepfakeOutput - The return type for the detectDeepfake function.
 */

import {z} from 'zod';
import {ImageAnnotatorClient} from '@google-cloud/vision';
import {generativeVisionModel} from '@/ai/genkit';

const DetectDeepfakeInputSchema = z.object({
  media: z
    .string()
    .describe(
      "The image, video or audio to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'")
  ,
  contentType: z
    .enum(['image', 'video', 'audio'])
    .describe('The type of the content.'),
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
  }).optional().describe('Analysis from the Vision API.'),
});
export type DetectDeepfakeOutput = z.infer<typeof DetectDeepfakeOutputSchema>;

export async function detectDeepfake(
  input: DetectDeepfakeInput
): Promise<DetectDeepfakeOutput> {
  let visionApiResult;
  let visionApiAnalysis;

  if (input.contentType === 'image') {
    try {
      const visionClient = new ImageAnnotatorClient();
      const imageContent = input.media.split(';base64,').pop()!;

      const [response] = await visionClient.safeSearchDetection({
        image: {content: imageContent},
      });
      
      const safeSearch = response.safeSearchAnnotation;
      visionApiResult = `Adult: ${safeSearch?.adult}, Medical: ${safeSearch?.medical}, Spoof: ${safeSearch?.spoof}, Violence: ${safeSearch?.violence}, Racy: ${safeSearch?.racy}`;
      visionApiAnalysis = {
          safeSearchResult: visionApiResult,
      };
    } catch (error) {
      console.error('Error calling Vision API:', error);
      visionApiResult = 'An error occurred while analyzing the image with the Vision API.';
    }
  }

  const visionApiText = visionApiResult
    ? `An additional analysis using Google Cloud's Vision API was performed. The result was:\n${visionApiResult}\nIncorporate this finding into your overall assessment.`
    : '';

  const prompt = `You are a digital forensics expert specializing in deepfake detection. Analyze the provided ${input.contentType} for any signs of digital manipulation, AI generation, or deepfaking.

  ${visionApiText}

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
          {text: prompt},
        ],
      },
    ],
  };

  const result = await generativeVisionModel.generateContent(request);
  const response = result.response;
  
  if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid or empty response received from the model');
  }

  const responseText = response.candidates[0].content.parts[0].text;

  try {
    // Clean up the response text by removing markdown code block markers and any surrounding whitespace
    const cleanJson = responseText
      .replace(/^```json\s*/, '')  // Remove opening ```json
      .replace(/```\s*$/, '')      // Remove closing ```
      .trim();                     // Remove any extra whitespace

    const parsedJson = JSON.parse(cleanJson);
    const validatedOutput = DetectDeepfakeOutputSchema.parse(parsedJson);
    validatedOutput.visionApiAnalysis = visionApiAnalysis;
    return validatedOutput;
  } catch (error) {
    console.error('Error parsing or validating model output:', error);
    // Handle cases where the model doesn't return valid JSON
    return {
      isDeepfake: false,
      confidenceScore: 0,
      analysis:
        'The model returned a response that was not in the expected JSON format.',
      visionApiAnalysis,
    };
  }
}
