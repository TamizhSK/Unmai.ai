'use server';
/**
 * @fileOverview Assesses the safety of content.
 *
 * - assessSafety - A function that assesses the safety of content.
 * - AssessSafetyInput - The input type for the assessSafety function.
 * - AssessSafetyOutput - The return type for the assessSafety function.
 */
import { z } from 'zod';
import { generativeModel, generativeVisionModel } from '../genkit';
const SafetyAssessmentInputSchema = z.object({
    content: z.string().describe('The content to be analyzed (text, image data URI, or URL).'),
    contentType: z.enum(['text', 'image', 'url']).describe('The type of the content.'),
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
        .describe('A list of topics or categories the content falls into (e.g., "politics", "health", "finance").'),
    contentAnalysis: z.string().describe('Detailed analysis of the content based on its type.'),
});
export async function assessSafety(input) {
    let result;
    if (input.contentType === 'image') {
        const [mimeType, base64Data] = input.content.split(';base64,');
        const imagePart = {
            inlineData: {
                mimeType: mimeType.replace('data:', ''),
                data: base64Data,
            },
        };
        const prompt = `
      Analyze the provided image and provide a safety assessment.
      Your response must be in valid JSON format and adhere to the specified schema.

      Based on the image, perform the following tasks:
      1.  Classify the content into one of the following categories: SAFE, HARMFUL, MISLEADING, UNKNOWN.
      2.  Provide a confidence score for your assessment (a number between 0.0 and 1.0).
      3.  Write a brief, neutral explanation for your assessment.
      4.  Identify the main topics or categories depicted in the image.
      5.  Provide a detailed content analysis including visual elements, text in the image, and potential concerns.

      Do not include any text outside of the JSON response.
    `;
        result = await generativeVisionModel.generateContent({
            contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
            },
        });
    }
    else {
        const prompt = `
      Analyze the following ${input.contentType} content and provide a safety assessment.
      Your response must be in valid JSON format and adhere to the specified schema.

      Content to analyze:
      "${input.content}"

      Based on the content, perform the following tasks:
      1.  Classify the content into one of the following categories: SAFE, HARMFUL, MISLEADING, UNKNOWN.
      2.  Provide a confidence score for your assessment (a number between 0.0 and 1.0).
      3.  Write a brief, neutral explanation for your assessment.
      4.  Identify the main topics or categories the content falls into (e.g., "politics", "health", "finance").
      5.  Provide a detailed content analysis including key claims, tone, and potential concerns.

      Do not include any text outside of the JSON response.
    `;
        result = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
            },
        });
    }
    const response = result.response;
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid or empty response received from the model');
    }
    const responseText = response.candidates[0].content.parts[0].text;
    if (!responseText) {
        throw new Error('No response text received from the model');
    }
    try {
        const parsedJson = JSON.parse(responseText);
        return SafetyAssessmentOutputSchema.parse(parsedJson);
    }
    catch (error) {
        console.error('Error parsing or validating model output:', error);
        throw new Error('Failed to get a valid safety assessment from the model.');
    }
}
//# sourceMappingURL=safety-assessment.js.map