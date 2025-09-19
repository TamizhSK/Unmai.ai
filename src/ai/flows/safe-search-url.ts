
'use server';
/**
 * @fileOverview Performs a safe search check on a URL using the Google Web Risk API.
 *
 * - safeSearchUrl - A function that checks a URL against Google's safe browsing lists.
 * - SafeSearchUrlInput - The input type for the safeSearchUrl function.
 * - SafeSearchUrlOutput - The return type for the safeSearchUrl function.
 */

import {z} from 'zod';
import {WebRiskServiceClient} from '@google-cloud/web-risk';

const SafeSearchUrlInputSchema = z.object({
  url: z.string().url().describe('The URL to check.'),
});
export type SafeSearchUrlInput = z.infer<typeof SafeSearchUrlInputSchema>;

const SafeSearchUrlOutputSchema = z.object({
  isSafe: z.boolean().describe('Whether the URL is considered safe.'),
  threatTypes: z.array(z.string()).describe('The types of threats found, if any.'),
  details: z.string().describe('Details about the scan results.'),
});
export type SafeSearchUrlOutput = z.infer<typeof SafeSearchUrlOutputSchema>;

const client = new WebRiskServiceClient();

export async function safeSearchUrl(
  input: SafeSearchUrlInput
): Promise<SafeSearchUrlOutput> {
  try {
    const request = {
      uri: input.url,
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
    };

    const [response] = await client.searchUris(request);

    if (response.threat) {
      return {
        isSafe: false,
        threatTypes: response.threat.threatTypes || [],
        details: `The URL is considered unsafe. Threat types found: ${response.threat.threatTypes?.join(', ')}.`,
      };
    } else {
      return {
        isSafe: true,
        threatTypes: [],
        details: 'The URL is considered safe.',
      };
    }
  } catch (error) {
    console.error('Error performing safe search:', error);
    return {
      isSafe: false,
      threatTypes: [],
      details: `An error occurred while scanning the URL: ${error instanceof Error ? error.message : 'Unknown error'}. The URL could not be verified.`,
    };
  }
}
