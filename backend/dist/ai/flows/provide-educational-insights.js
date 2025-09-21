'use server';
/**
 * @fileOverview Provides educational insights about content.
 *
 * - provideEducationalInsights - A function that provides educational insights for content.
 * - ProvideEducationalInsightsInput - The input type for the provideEducationalInsights function.
 * - ProvideEducationalInsightsOutput - The return type for the provideEducationalInsights function.
 */
import { z } from 'zod';
import { generativeModel } from '../genkit';
const ProvideEducationalInsightsInputSchema = z.object({
    text: z.string().describe('The text content to analyze for educational insights.'),
});
const ProvideEducationalInsightsOutputSchema = z.object({
    insights: z
        .string()
        .describe('Educational insights and analysis report about the type and means of misleading content.'),
});
export async function provideEducationalInsights(input) {
    const prompt = `You are an AI assistant designed to provide educational insights and analysis reports about the type and means of misleading content.

  Analyze the following text and provide insights on the potential misleading indicators, such as emotional language, lack of credible sources, or inconsistencies with known facts. Explain the underlying reasons a piece of content might be misleading.

  Text: ${input.text}

  Provide a detailed analysis report in a JSON object with an "insights" field.
  `;
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
        return ProvideEducationalInsightsOutputSchema.parse(parsedJson);
    }
    catch (error) {
        console.error('Error parsing or validating model output:', error);
        return {
            insights: 'The model returned a response that was not in the expected JSON format.',
        };
    }
}
//# sourceMappingURL=provide-educational-insights.js.map