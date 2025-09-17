'use server';

/**
 * @fileOverview This flow provides educational insights and analysis reports about the type and means of misleading content.
 *
 * - provideEducationalInsights - A function that provides educational insights on misinformation.
 * - ProvideEducationalInsightsInput - The input type for the provideEducationalInsights function.
 * - ProvideEducationalInsightsOutput - The return type for the provideEducationalInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProvideEducationalInsightsInputSchema = z.object({
  text: z.string().describe('The text content to analyze for educational insights.'),
});
export type ProvideEducationalInsightsInput = z.infer<
  typeof ProvideEducationalInsightsInputSchema
>;

const ProvideEducationalInsightsOutputSchema = z.object({
  insights: z
    .string()
    .describe(
      'Educational insights and analysis report about the type and means of misleading content.'
    ),
});
export type ProvideEducationalInsightsOutput = z.infer<
  typeof ProvideEducationalInsightsOutputSchema
>;

export async function provideEducationalInsights(
  input: ProvideEducationalInsightsInput
): Promise<ProvideEducationalInsightsOutput> {
  return provideEducationalInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'provideEducationalInsightsPrompt',
  input: {schema: ProvideEducationalInsightsInputSchema},
  output: {schema: ProvideEducationalInsightsOutputSchema},
  prompt: `You are an AI assistant designed to provide educational insights and analysis reports about the type and means of misleading content.

  Analyze the following text and provide insights on the potential misleading indicators, such as emotional language, lack of credible sources, or inconsistencies with known facts. Explain the underlying reasons a piece of content might be misleading.

  Text: {{{text}}}

  Provide a detailed analysis report:
  `,
});

const provideEducationalInsightsFlow = ai.defineFlow(
  {
    name: 'provideEducationalInsightsFlow',
    inputSchema: ProvideEducationalInsightsInputSchema,
    outputSchema: ProvideEducationalInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
