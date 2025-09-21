'use server';
/**
 * @fileOverview Explains misleading indicators in content. be misleading.
 *
 * - explainMisleadingIndicators - A function that explains misleading indicators.
 * - ExplainMisleadingIndicatorsInput - The input type for the explainMisleadingIndicators function.
 * - ExplainMisleadingIndicatorsOutput - The return type for the explainMisleadingIndicators function.
 */
import { z } from 'zod';
import { generativeModel } from '../genkit';
const ExplainMisleadingIndicatorsInputSchema = z.object({
    content: z.string().describe('The content to be analyzed for misleading indicators.'),
});
const ExplainMisleadingIndicatorsOutputSchema = z.object({
    explanation: z.string().describe('Explanation of why the content might be misleading.'),
});
export async function explainMisleadingIndicators(input) {
    const prompt = `Analyze the following content and explain why it might be misleading. Consider factors such as emotional language, lack of credible sources, inconsistencies with known facts, and potential biases.\n\nContent: ${input.content}\n\nYour response should be a JSON object with an \"explanation\" field.`;
    const result = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: 'application/json',
        },
    });
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
        return ExplainMisleadingIndicatorsOutputSchema.parse(parsedJson);
    }
    catch (error) {
        console.error('Error parsing or validating model output:', error);
        return {
            explanation: 'The model returned a response that was not in the expected JSON format.',
        };
    }
}
//# sourceMappingURL=explain-misleading-indicators.js.map