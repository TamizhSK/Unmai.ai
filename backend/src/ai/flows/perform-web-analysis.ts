'use server';
/**
 * @fileOverview Performs web analysis for content.
 *
 * - performWebAnalysis - A function that performs web analysis for content.
 * - PerformWebAnalysisInput - The input type for the performWebAnalysis function.
 * - PerformWebAnalysisOutput - The return type for the performWebAnalysis function.
 */

import {z} from 'zod';
import {groundedModel} from '../genkit';

const PerformWebAnalysisInputSchema = z.object({
  query: z.string().describe('The query or content to analyze in real-time.'),
  contentType: z.enum(['text', 'url']).describe('The type of the content.'),
});
export type PerformWebAnalysisInput = z.infer<typeof PerformWebAnalysisInputSchema>;

const PerformWebAnalysisOutputSchema = z.object({
  realTimeFactCheck: z.boolean().describe('Whether real-time fact checking was performed.'),
  currentInformation: z.array(z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string(),
    date: z.string(),
    relevance: z.number().min(0).max(100),
  })).describe('Current information found during real-time analysis.'),
  informationGaps: z.array(z.string()).describe('Information gaps or areas needing more research.'),
  analysisSummary: z.string().describe('Summary of the real-time web analysis findings.'),
});
export type PerformWebAnalysisOutput = z.infer<typeof PerformWebAnalysisOutputSchema>;

export async function performWebAnalysis(
  input: PerformWebAnalysisInput
): Promise<PerformWebAnalysisOutput> {
  const prompt = `You are an expert in real-time web analysis and fact-checking.

  Perform a real-time analysis of the following ${input.contentType} content:
  "${input.query}"
  
  Your task is to:
  1. Search for current information related to this content
  2. Identify the most relevant and recent sources
  3. Check for any fact-checking articles or debunking information
  4. Identify information gaps that need further research
  5. Provide a summary of your findings
  
  Your response must be in the following JSON format:
  {
    "realTimeFactCheck": true,
    "currentInformation": [
      {
        "title": "Article Title",
        "url": "https://example.com/article",
        "snippet": "Brief snippet from the article...",
        "date": "2023-01-01",
        "relevance": 90
      }
    ],
    "informationGaps": [
      "Specific areas where more information is needed"
    ],
    "analysisSummary": "Summary of the real-time web analysis findings"
  }
  
  Example response:
  {
    "realTimeFactCheck": true,
    "currentInformation": [
      {
        "title": "Recent Developments in AI Technology",
        "url": "https://tech-news.com/ai-developments",
        "snippet": "Latest breakthroughs in artificial intelligence include...",
        "date": "2023-06-15",
        "relevance": 85
      }
    ],
    "informationGaps": [
      "Long-term implications of these developments"
    ],
    "analysisSummary": "The query relates to recent AI developments with several current articles available."
  }`;

  try {
    const result = await groundedModel.generateContent({
      contents: [{role: 'user', parts: [{text: prompt}]}],
    });

    const response = result.response;
    
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid or empty response received from the model');
    }

    const responseText = response.candidates[0].content.parts[0].text;

    // Clean up the response text by removing markdown code block markers if present
    const cleanJson = responseText
      .replace(/^```json\s*/, '')  // Remove opening ```json
      .replace(/```\s*$/, '')      // Remove closing ```
      .trim();                     // Remove any extra whitespace

    const parsedJson = JSON.parse(cleanJson);
    return PerformWebAnalysisOutputSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error in real-time web analysis:', error);
    return {
      realTimeFactCheck: false,
      currentInformation: [],
      informationGaps: [],
      analysisSummary: `Failed to perform real-time web analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}