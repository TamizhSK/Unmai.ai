'use server';
/**
 * @fileOverview Analyzes content for potential misinformation.
 *
 * - analyzeContentForMisinformation - A function that analyzes content for misinformation.
 * - AnalyzeContentInput - The input type for the analyzeContentForMisinformation function.
 * - AnalyzeContentOutput - The return type for the analyzeContentForMisinformation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeContentInputSchema = z.object({
  content: z.string().describe('The content to analyze (text, image data URI, or URL).'),
});
export type AnalyzeContentInput = z.infer<typeof AnalyzeContentInputSchema>;

const AnalyzeContentOutputSchema = z.object({
  misinformationPotential: z
    .number()
    .describe(
      'A score from 0 to 1 indicating the potential for misinformation. Higher values indicate higher potential.'
    ),
  explanation: z.string().describe('An explanation of why the content might be misleading.'),
  sourceReliability: z.string().optional().describe('Reliability of the source if the content is a URL.'),
});
export type AnalyzeContentOutput = z.infer<typeof AnalyzeContentOutputSchema>;

export async function analyzeContentForMisinformation(
  input: AnalyzeContentInput
): Promise<AnalyzeContentOutput> {
  return analyzeContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeContentPrompt',
  input: {schema: AnalyzeContentInputSchema},
  output: {schema: AnalyzeContentOutputSchema},
  prompt: `You are an expert in identifying misinformation and disinformation.

  Analyze the following content and determine its potential for misinformation.

  Content: {{{content}}}

  Provide a misinformationPotential score (0-1) and an explanation for your assessment.
  If the content is a URL, also assess the source reliability.

  Your output should be formatted as a JSON object matching the AnalyzeContentOutputSchema.
  Include a "sourceReliability" field if the content is a URL.`,
});

const analyzeContentFlow = ai.defineFlow(
  {
    name: 'analyzeContentFlow',
    inputSchema: AnalyzeContentInputSchema,
    outputSchema: AnalyzeContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
