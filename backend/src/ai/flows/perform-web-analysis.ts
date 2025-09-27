'use server';
/**
 * @fileOverview Performs web analysis for content.
 *
 * - performWebAnalysis - A function that performs web analysis for content.
 * - PerformWebAnalysisInput - The input type for the performWebAnalysis function.
 * - PerformWebAnalysisOutput - The return type for the performWebAnalysis function.
 */

import {z} from 'zod';
import {groundedModel, customSearchModel} from '../genkit.js';
import { config } from 'dotenv';

// Load environment variables
config();

const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (compatible; unmai.ai/1.0; +https://unmai.ai)';
const CSE_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const DEFAULT_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

const PerformWebAnalysisInputSchema = z.object({
  query: z.string().describe('The query or content to analyze in real-time.'),
  contentType: z.enum(['text', 'url']).describe('The type of the content.'),
  searchEngineId: z.string().optional().describe('The ID of the custom search engine to use.'),
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

function sanitizeCurrentInformation(rawItems: unknown): Array<{
  title: string;
  url: string;
  snippet: string;
  date: string;
  relevance: number;
}> {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item, index) => {
      const record = item as Record<string, unknown>;

      const url = typeof record.url === 'string' ? record.url : '';
      const snippet = typeof record.snippet === 'string' ? record.snippet : '';
      const date = typeof record.date === 'string' ? record.date : '';

      const fallbackTitleFromUrl = (() => {
        if (!url) return '';
        try {
          const { hostname } = new URL(url);
          return hostname || '';
        } catch {
          return '';
        }
      })();

      const title = (() => {
        if (typeof record.title === 'string' && record.title.trim().length > 0) {
          return record.title.trim();
        }
        if (fallbackTitleFromUrl) {
          return fallbackTitleFromUrl;
        }
        if (snippet.trim().length > 0) {
          return snippet.trim().slice(0, 80);
        }
        return `Untitled source ${index + 1}`;
      })();

      const relevanceRaw = record.relevance;
      const relevance = typeof relevanceRaw === 'number' && Number.isFinite(relevanceRaw)
        ? Math.max(0, Math.min(100, relevanceRaw))
        : Math.max(0, 100 - index * 10);

      return {
        title,
        url,
        snippet,
        date,
        relevance,
      };
    });
}

type ScrapeResult = {
  content: string;
  status?: number;
  statusText?: string;
  errorMessage?: string;
};

// Enhanced URL content scraper with better error handling
async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    // Validate URL format
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        content: '',
        errorMessage: 'Only HTTP and HTTPS URLs are supported'
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      console.warn(`[WARN] URL fetch failed: ${url} - ${errorMsg}`);
      
      // Return empty string for 404s and other client errors instead of throwing
      if (response.status >= 400 && response.status < 500) {
        return {
          content: '',
          status: response.status,
          statusText: response.statusText
        };
      }
      throw new Error(errorMsg);
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      console.warn(`[WARN] Non-text content type: ${contentType} for URL: ${url}`);
      return {
        content: '',
        status: response.status,
        statusText: response.statusText,
        errorMessage: `Unsupported content type: ${contentType}`
      };
    }
    
    const html = await response.text();
    
    // Enhanced text extraction - remove HTML tags and get readable content
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '') // Remove navigation
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '') // Remove headers
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '') // Remove footers
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '') // Remove sidebars
      .replace(/<[^>]*>/g, ' ') // Remove remaining HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Return first 2000 characters for analysis
    const result = textContent.substring(0, 2000);
    console.log(`[INFO] Successfully scraped ${result.length} characters from ${url}`);
    return { content: result };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[WARN] Failed to scrape URL ${url}: ${errorMsg}`);
    
    // Return empty string instead of throwing for common errors
    if (errorMsg.includes('fetch failed') || errorMsg.includes('timeout') || errorMsg.includes('404')) {
      return { content: '', errorMessage: errorMsg };
    }
    return { content: '', errorMessage: `Failed to scrape URL: ${errorMsg}` };
  }
}

// Optional: Google Custom Search JSON API (text search)
async function customSearch(query: string, cx: string): Promise<Array<{ title: string; url: string; snippet: string; date: string; relevance: number }>> {
  try {
    const trimmed = (query || '').toString().slice(0, 512);
    const params = new URLSearchParams({
      key: CSE_API_KEY as string,
      cx,
      q: trimmed,
      num: '5',
      safe: 'active'
    });
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn(`[WARN] CSE fetch failed: HTTP ${res.status} ${res.statusText} ${t}`);
      return [];
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const mapped: Array<{ title: string; url: string; snippet: string; date: string; relevance: number }> = items.map((it: any, idx: number) => ({
      title: String(it.title || ''),
      url: String(it.link || it.formattedUrl || ''),
      snippet: String(it.snippet || it.htmlSnippet || ''),
      date: String(it.pagemap?.metatags?.[0]?.['article:published_time'] || it.pagemap?.metatags?.[0]?.['og:updated_time'] || ''),
      relevance: Math.max(0, 100 - idx * 10)
    }));
    return mapped.filter((result) => Boolean(result.url));
  } catch (err) {
    console.warn('[WARN] CSE query error:', err);
    return [];
  }
}

export async function performWebAnalysis(
  input: PerformWebAnalysisInput
): Promise<PerformWebAnalysisOutput> {
  let content = input.query;
  let urlScrapingFailed = false;
  let urlScrapeInfo: { status?: number; statusText?: string; error?: string } | null = null;
  let cseResults: Array<{ title: string; url: string; snippet: string; date: string; relevance: number }> = [];
  if (input.contentType === 'url') {
    try {
      const scrapeResult = await scrapeUrl(input.query);
      const scrapedContent = scrapeResult.content;
      if (scrapedContent.trim().length > 0) {
        content = scrapedContent;
        console.log(`[INFO] Successfully scraped content from URL: ${input.query}`);
      } else {
        console.warn(`[WARN] URL returned empty content: ${input.query}`);
        urlScrapingFailed = true;
        urlScrapeInfo = {
          status: scrapeResult.status,
          statusText: scrapeResult.statusText,
          error: scrapeResult.errorMessage
        };
        // Use the original URL as content for analysis
        content = `URL analysis for: ${input.query}`;
      }
    } catch (error) {
      console.error(`[ERROR] Failed to scrape URL ${input.query}:`, error);
      urlScrapingFailed = true;
      urlScrapeInfo = {
        error: error instanceof Error ? error.message : 'Unknown scrape error'
      };
      // Use the original URL as content for analysis
      content = `URL analysis for: ${input.query}`;
    }
  }

  // Attempt CSE grounding if keys are present
  const effectiveCx = input.searchEngineId || DEFAULT_SEARCH_ENGINE_ID;
  if (CSE_API_KEY && effectiveCx) {
    try {
      const queryForSearch = input.contentType === 'url' ? input.query : content;
      cseResults = await customSearch(queryForSearch, effectiveCx);
      if (cseResults.length > 0) {
        console.log(`[INFO] CSE returned ${cseResults.length} items for grounding`);
      }
    } catch (e) {
      console.warn('[WARN] CSE grounding failed:', e);
    }
  }

  const cseGroundingSection = cseResults.length > 0
    ? `\n\nUse the following web search results as grounding evidence. Prefer citing these URLs in "currentInformation":\n${JSON.stringify(cseResults.slice(0, 5))}`
    : '';

  const prompt = `You are an expert in real-time web analysis and fact-checking.

  Perform a real-time analysis of the following content:
  "${content}"
  
  Your task is to:
  1. Search for current information related to this content
  2. Identify the most relevant and recent sources
  3. Check for any fact-checking articles or debunking information
  4. Identify information gaps that need further research
  5. Provide a summary of your findings
  ${cseGroundingSection}
  
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
    const model = input.searchEngineId ? customSearchModel(input.searchEngineId) : groundedModel;
    const result = await model.generateContent({
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
    const sanitized = {
      ...parsedJson,
      currentInformation: sanitizeCurrentInformation(
        (parsedJson as Record<string, unknown> | null)?.currentInformation
      )
    };
    return PerformWebAnalysisOutputSchema.parse(sanitized);
  } catch (error) {
    console.error('Error in real-time web analysis:', error);
    
    // Provide specific feedback based on whether URL scraping failed
    let analysisSummary = `Failed to perform real-time web analysis: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    if (urlScrapingFailed && input.contentType === 'url') {
      const statusDetail = urlScrapeInfo?.status
        ? ` (HTTP ${urlScrapeInfo.status}${urlScrapeInfo.statusText ? ` ${urlScrapeInfo.statusText}` : ''})`
        : '';
      const errorDetail = urlScrapeInfo?.error ? ` Reason: ${urlScrapeInfo.error}.` : '';
      analysisSummary = `Unable to access the provided URL (${input.query})${statusDetail}. This may be due to the website being unavailable, requiring authentication, or blocking automated access.${errorDetail} The URL structure and domain can still be analyzed for safety indicators.`;
    }
    
    return {
      realTimeFactCheck: urlScrapingFailed ? false : true,
      currentInformation: [],
      informationGaps: urlScrapingFailed ? [
        'Website content could not be accessed for detailed analysis',
        'Manual verification of the URL content is recommended',
        'Check if the website requires authentication or has access restrictions'
      ] : ['Additional context and verification sources needed'],
      analysisSummary,
    };
  }
}
