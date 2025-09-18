'use server';

import {z} from 'zod';
import {generativeModel} from '@/ai/genkit';

const SafetyAssessmentInputSchema = z.object({
  content: z.string().describe('The text content to be analyzed'),
});

const SafetyAssessmentOutputSchema = z.object({
  safetyRating: z
    .enum(['SAFE', 'HARMFUL', 'MISLEADING', 'UNKNOWN'])
    .describe('The overall safety classification of the content.'),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe("The model's confidence in its assessment, from 0.0 to 1.0."),
  explanation: z
    .string()
    .describe('A brief explanation of why the content received the given rating.'),
  topics: z
    .array(z.string())
    .describe(
      'A list of topics or categories the content falls into (e.g., "politics", "health", "finance").'
    ),
});

export async function assessSafety(
  input: z.infer<typeof SafetyAssessmentInputSchema>
): Promise<z.infer<typeof SafetyAssessmentOutputSchema>> {
  const prompt = `
    Analyze the following text content and provide a safety assessment.
    Your response must be in valid JSON format and adhere to the specified schema.

    Content to analyze:
    "${input.content}"

    Based on the content, perform the following tasks:
    1.  Classify the content into one of the following categories: SAFE, HARMFUL, MISLEADING, UNKNOWN.
    2.  Provide a confidence score for your assessment (a number between 0.0 and 1.0).
    3.  Write a brief, neutral explanation for your assessment.
    4.  Identify the main topics or categories of the content.

    Do not include any text outside of the JSON response.
  `;

  const result = await generativeModel.generateContent({
    contents: [{role: 'user', parts: [{text: prompt}]}],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const response = result.response;
  const responseText = response.candidates[0].content.parts[0].text;

  if (!responseText) {
    throw new Error('No response text received from the model');
  }

  try {
    const parsedJson = JSON.parse(responseText);
    return SafetyAssessmentOutputSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error parsing or validating model output:', error);
    throw new Error('Failed to get a valid safety assessment from the model.');
  }
}