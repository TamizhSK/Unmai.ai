'use server';
/**
 * @fileOverview Performs web analysis using multiple search sources.
 * 
 * Replaced Google Custom Search with:
 * - Google Fact Check Tools API
 * - Google Knowledge Graph API  
 * - Wikipedia API
 * - Google News Search
 *
 * - performWebAnalysis - A function that performs web analysis for content.
 * - PerformWebAnalysisInput - The input type for the performWebAnalysis function.
 * - PerformWebAnalysisOutput - The return type for the performWebAnalysis function.
 */

import {z} from 'zod';
import {groundedModel} from '../genkit.js';
import { performWebSearch, type SearchResult } from '../../lib/web-search-service.js';

const PerformWebAnalysisInputSchema = z.object({
  query: z.string().describe('The query or content to analyze in real-time.'),
  contentType: z.enum(['text', 'url']).describe('The type of the content.'),
  mediaType: z.enum(['text', 'image', 'video', 'audio']).optional().describe('Hint for the type of media to bias the search.'),
  searchEngineId: z.string().optional().describe('Deprecated: No longer used'),
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

/**
 * Perform web analysis using the new multi-source search service
 */
export async function performWebAnalysis(
  input: PerformWebAnalysisInput
): Promise<PerformWebAnalysisOutput> {
  console.log(`[WebAnalysis] Analyzing query: "${input.query.substring(0, 50)}${input.query.length > 50 ? '...' : ''}"`);

  try {
    // Use the new web search service (no CSE dependency)
    const searchResult = await performWebSearch(input.query);

    // Map results to expected format
    const currentInformation = searchResult.results.map((result: SearchResult) => ({
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      date: result.date || '',
      relevance: result.relevance,
    }));

    // Identify information gaps
    const informationGaps: string[] = [];
    
    if (currentInformation.length < 3) {
      informationGaps.push('Limited sources found - consider manual verification');
    }
    
    if (!currentInformation.some((r) => r.url.includes('factcheck') || r.url.includes('snopes'))) {
      informationGaps.push('No dedicated fact-checking sources found');
    }

    // Generate summary
    const analysisSummary = currentInformation.length > 0
      ? `Found ${currentInformation.length} relevant sources from multiple databases including fact-checking resources, news outlets, and knowledge bases.`
      : 'No relevant sources found through automated search. Manual verification recommended.';

    return {
      realTimeFactCheck: true,
      currentInformation,
      informationGaps,
      analysisSummary,
    };
  } catch (error) {
    console.error('[WebAnalysis] Failed:', error instanceof Error ? error.message : 'Unknown error');
    
    // Return graceful fallback
    return {
      realTimeFactCheck: false,
      currentInformation: [],
      informationGaps: ['Web search unavailable - manual verification required'],
      analysisSummary: 'Unable to perform real-time web analysis. Please verify claims manually using trusted sources.',
    };
  }
}

export default performWebAnalysis;
