'use server';
/**
 * @fileOverview AI agent to detect deepfakes in images, videos and audio.
 *
 * - detectDeepfake - A function that handles the deepfake detection process.
 * - DetectDeepfakeInput - The input type for the detectDeepfake function.
 * - DetectDeepfakeOutput - The return type for the detectDeepfake function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectDeepfakeInputSchema = z.object({
  media: z
    .string()
    .describe(
      "The image, video or audio to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  contentType: z
    .enum(['image', 'video', 'audio'])
    .describe('The type of the content.'),
});
export type DetectDeepfakeInput = z.infer<typeof DetectDeepfakeInputSchema>;

const DetectDeepfakeOutputSchema = z.object({
  isDeepfake: z
    .boolean()
    .describe('Whether the content is likely a deepfake or manipulated.'),
  confidenceScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      'A confidence score (0-100) for the deepfake assessment. Higher means more certain.'
    ),
  analysis: z
    .string()
    .describe(
      'A detailed forensic analysis explaining the findings, including any artifacts, inconsistencies, or signs of manipulation.'
    ),
});
export type DetectDeepfakeOutput = z.infer<typeof DetectDeepfakeOutputSchema>;

export async function detectDeepfake(
  input: DetectDeepfakeInput
): Promise<DetectDeepfakeOutput> {
  return detectDeepfakeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectDeepfakePrompt',
  input: {schema: DetectDeepfakeInputSchema},
  output: {schema: DetectDeepfakeOutputSchema},
  model: 'googleai/gemini-1.5-flash-latest',
  prompt: `You are a digital forensics expert specializing in deepfake detection. Analyze the provided {{contentType}} for any signs of digital manipulation, AI generation, or deepfaking.

  Media for analysis:
  {{media url=media}}

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

  Based on your analysis, determine if the content is a deepfake or manipulated. Provide a confidence score and a detailed report of your findings. Your response must be in a structured JSON format.`,
});

const detectDeepfakeFlow = ai.defineFlow(
  {
    name: 'detectDeepfakeFlow',
    inputSchema: DetectDeepfakeInputSchema,
    outputSchema: DetectDeepfakeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
