
'use server';
/**
 * @fileOverview AI agent to get a credibility score for a given piece of content.
 *
 * - getCredibilityScore - A function that handles the process of getting a credibility score for content.
 * - GetCredibilityScoreInput - The input type for the getCredibilityScore function.
 * - GetCredibilityScoreOutput - The return type for the getCredibilityScore function.
 */

import {ai} from '@/ai/genkit';
import {GenerateRequest} from 'genkit';
import {z} from 'genkit';

const GetCredibilityScoreInputSchema = z.object({
  content: z
    .string()
    .describe(
      'The content to analyze for credibility. If it is an image, it will be a data URI.'
    ),
  contentType: z
    .enum(['text', 'image', 'url'])
    .describe('The type of the content.'),
});
export type GetCredibilityScoreInput = z.infer<
  typeof GetCredibilityScoreInputSchema
>;

const GetCredibilityScoreOutputSchema = z.object({
  credibilityScore: z
    .number()
    .describe('A score representing the credibility of the content (0-100).'),
  assessmentSummary: z
    .string()
    .describe('A brief, factual summary of the main claims in the content (max 2 sentences).'),
  misleadingIndicators: z
    .array(z.string())
    .describe(
      'Specific indicators suggesting the content might be misleading.'
    ),
  source: z.string().describe("The source of the content (e.g., domain for URL, 'User Text', 'Uploaded Image').")
});
export type GetCredibilityScoreOutput = z.infer<
  typeof GetCredibilityScoreOutputSchema
>;

export async function getCredibilityScore(
  input: GetCredibilityScoreInput
): Promise<GetCredibilityScoreOutput> {
  return getCredibilityScoreFlow(input);
}

const textPrompt = ai.definePrompt({
  name: 'getCredibilityScoreTextPrompt',
  input: {
    schema: z.object({
      contentType: z.enum(['text', 'url']),
      content: z.string(),
    }),
  },
  output: {schema: GetCredibilityScoreOutputSchema},
  model: 'googleai/gemini-1.5-flash-latest',
  prompt: `You are an AI assistant designed to assess the credibility of content.

  Analyze the following content. Identify the main claim, and provide a credibility score, a very brief factual summary of the assessment (max 2 sentences), and any misleading indicators. The content type is '{{{contentType}}}'.

  Content: {{{content}}}

  If the content is a URL, extract and return the domain as the 'source'.
  If the content is plain text, return 'User Text' as the 'source'.

  Respond in a structured JSON format.
  `,
});

const imagePrompt = ai.definePrompt({
  name: 'getCredibilityScoreImagePrompt',
  input: {
    schema: z.object({
      contentType: z.literal('image'),
      content: z.string(),
    }),
  },
  output: {schema: GetCredibilityScoreOutputSchema},
  model: 'googleai/gemini-1.5-flash-latest',
  prompt: `You are an AI assistant designed to assess the credibility of images.

  Analyze the following image. Identify its main claim or message, and provide a credibility score, a very brief factual summary of your assessment (max 2 sentences), and any misleading indicators.

  Image:
  {{media url=content}}

  Return 'Uploaded Image' as the 'source'.
  
  Respond in a structured JSON format.
  `,
});

const getCredibilityScoreFlow = ai.defineFlow(
  {
    name: 'getCredibilityScoreFlow',
    inputSchema: GetCredibilityScoreInputSchema,
    outputSchema: GetCredibilityScoreOutputSchema,
  },
  async input => {
    let output;
    if (input.contentType === 'image') {
      const {output: imageOutput} = await imagePrompt(input);
      output = imageOutput;
    } else {
      const {output: textOutput} = await textPrompt(input);
      output = textOutput;
    }

    if (!output) {
      throw new Error("Analysis failed to produce an output.");
    }
    
    // Ensure source is set based on content type
    if (input.contentType === 'url') {
      try {
        const url = new URL(input.content);
        output.source = url.hostname;
      } catch (e) {
        output.source = 'Invalid URL';
      }
    } else if (input.contentType === 'text') {
        output.source = 'User Text';
    } else if (input.contentType === 'image') {
        output.source = 'Uploaded Image';
    }

    return output;
  }
);
