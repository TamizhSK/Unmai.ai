/**
 * Web Search Service
 * 
 * Performs web searches using multiple sources:
 * - Google Fact Check Tools API
 * - Google Knowledge Graph API
 * - Wikipedia API
 * - Google News Search
 * 
 * No dependency on Google Custom Search Engine (CSE).
 */

import { environmentInitializer } from '../lib/environment-initializer.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; unmai.ai/1.0; +https://unmai.ai)';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  source?: string;
  relevance: number;
}

export interface WebSearchResult {
  results: SearchResult[];
  searchMethod: string;
  query: string;
}

/**
 * Helper to perform fetch with timeout
 */
async function fetchWithTimeout(url: string, options: any = {}): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Search using Google Fact Check Tools API
 */
async function searchFactCheckTools(query: string): Promise<SearchResult[]> {
  try {
    const apiKey = environmentInitializer.getOptional('GOOGLE_API_KEY', 
                   environmentInitializer.getOptional('GEMINI_API_KEY', ''));
    
    if (!apiKey) {
      return [];
    }

    const url = new URL('https://factchecktools.googleapis.com/v1alpha1/claims:search');
    url.searchParams.append('query', query);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('pageSize', '10');

    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      console.warn('[Search] Fact Check Tools API failed:', response.status);
      return [];
    }

    const data = await response.json();
    const claims = data.claims || [];

    return claims.map((claim: any) => ({
      title: claim.claimant || 'Fact Check',
      url: claim.claimReview?.[0]?.url || '',
      snippet: claim.text || claim.claimReview?.[0]?.title || '',
      date: claim.claimReview?.[0]?.publishDate || '',
      source: claim.claimant,
      relevance: 95,
    })).filter((r: SearchResult) => r.url || r.snippet);
  } catch (error: any) {
    console.warn('[Search] Fact Check Tools error:', error.message === 'This operation was aborted' ? 'Timeout' : error.message);
    return [];
  }
}

/**
 * Search using Google Knowledge Graph API
 */
async function searchKnowledgeGraph(query: string): Promise<SearchResult[]> {
  try {
    const apiKey = environmentInitializer.getOptional('GOOGLE_API_KEY', 
                   environmentInitializer.getOptional('GEMINI_API_KEY', ''));
    
    if (!apiKey) {
      return [];
    }

    const url = new URL('https://kgsearch.googleapis.com/v1/entities:search');
    url.searchParams.append('query', query);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('limit', '10');
    url.searchParams.append('languages', 'en');

    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      console.warn('[Search] Knowledge Graph API failed:', response.status);
      return [];
    }

    const data = await response.json();
    const items = data.itemListElement || [];

    return items.map((item: any) => {
      const entity = item.result;
      const description = entity.detailedDescription?.articleBody || 
                         entity.detailedDescription?.url || '';
      
      return {
        title: entity.name || 'Knowledge Graph Result',
        url: entity.detailedDescription?.url || '',
        snippet: description,
        source: 'Google Knowledge Graph',
        relevance: 90,
      };
    }).filter((r: SearchResult) => r.url || r.snippet);
  } catch (error: any) {
    console.warn('[Search] Knowledge Graph error:', error.message === 'This operation was aborted' ? 'Timeout' : error.message);
    return [];
  }
}

/**
 * Search Wikipedia API
 */
async function searchWikipedia(query: string): Promise<SearchResult[]> {
  try {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.append('action', 'query');
    url.searchParams.append('list', 'search');
    url.searchParams.append('srsearch', query);
    url.searchParams.append('format', 'json');
    url.searchParams.append('srlimit', '10');

    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      console.warn('[Search] Wikipedia API failed:', response.status);
      return [];
    }

    const data = await response.json();
    const items = data.query?.search || [];

    return items.map((item: any) => ({
      title: item.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
      snippet: item.snippet,
      date: item.timestamp,
      source: 'Wikipedia',
      relevance: 85,
    }));
  } catch (error: any) {
    console.warn('[Search] Wikipedia error:', error.message === 'This operation was aborted' ? 'Timeout' : error.message);
    return [];
  }
}

/**
 * Search Google News
 */
async function searchGoogleNews(query: string): Promise<SearchResult[]> {
  try {
    // Use Google News RSS feed via a public endpoint
    const encodedQuery = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      console.warn('[Search] Google News failed:', response.status);
      return [];
    }

    const xmlText = await response.text();
    const items: SearchResult[] = [];

    // Simple XML parsing for RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
      const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        items.push({
          title: titleMatch[1]?.replace(/&amp;/g, '&') || '',
          url: linkMatch[1]?.replace(/&amp;/g, '&') || '',
          snippet: descMatch?.[1]?.replace(/&amp;/g, '&') || '',
          date: dateMatch?.[1],
          source: 'Google News',
          relevance: 88,
        });
      }
    }

    return items.slice(0, 10);
  } catch (error: any) {
    console.warn('[Search] Google News error:', error.message === 'This operation was aborted' ? 'Timeout' : error.message);
    return [];
  }
}

/**
 * Perform comprehensive web search using all available sources
 */
export async function performWebSearch(query: string): Promise<WebSearchResult> {
  console.log(`[Search] Searching for: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);

  // Run all searches in parallel
  const [factCheck, knowledgeGraph, wikipedia, news] = await Promise.all([
    searchFactCheckTools(query),
    searchKnowledgeGraph(query),
    searchWikipedia(query),
    searchGoogleNews(query),
  ]);

  // Combine and deduplicate results
  const allResults = [
    ...factCheck,
    ...knowledgeGraph,
    ...wikipedia,
    ...news,
  ];

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueResults = allResults.filter((result) => {
    if (!result.url || seen.has(result.url)) {
      return false;
    }
    seen.add(result.url);
    return true;
  });

  // Sort by relevance
  uniqueResults.sort((a, b) => b.relevance - a.relevance);

  // Take top 15 results
  const topResults = uniqueResults.slice(0, 15);

  console.log(`[Search] Found ${topResults.length} results`);

  return {
    results: topResults,
    searchMethod: 'Multi-source search (Fact Check + Knowledge Graph + Wikipedia + News)',
    query,
  };
}

/**
 * Legacy compatibility function matching old API signature
 */
export async function performWebAnalysis(input: {
  query: string;
  contentType?: string;
  mediaType?: string;
  searchEngineId?: string;
}): Promise<{
  realTimeFactCheck: boolean;
  currentInformation: SearchResult[];
  informationGaps: string[];
  analysisSummary: string;
}> {
  const searchResult = await performWebSearch(input.query);

  return {
    realTimeFactCheck: true,
    currentInformation: searchResult.results,
    informationGaps: searchResult.results.length < 5 
      ? ['Limited recent sources found', 'Consider checking additional fact-checking databases']
      : [],
    analysisSummary: `Found ${searchResult.results.length} relevant sources using ${searchResult.searchMethod}`,
  };
}

export default {
  performWebSearch,
  performWebAnalysis,
  searchFactCheckTools,
  searchKnowledgeGraph,
  searchWikipedia,
  searchGoogleNews,
};
