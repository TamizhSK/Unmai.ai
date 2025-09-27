'use server';
/**
 * @fileOverview Performs a safe search check on a URL using the Google Web Risk API.
 *
 * - safeSearchUrl - A function that checks a URL against Google's safe browsing lists.
 * - SafeSearchUrlInput - The input type for the safeSearchUrl function.
 * - SafeSearchUrlOutput - The return type for the safeSearchUrl function.
 */
import { z } from 'zod';
import { WebRiskServiceClient, protos } from '@google-cloud/web-risk';
import { config } from 'dotenv';
// Load environment variables
config();
// Initialize Web Risk client with error handling
const client = new WebRiskServiceClient();
// Validate Web Risk API availability
const validateWebRiskAPI = async () => {
    try {
        console.log('[INFO] Web Risk API client initialized');
    }
    catch (error) {
        console.warn('[WARN] Web Risk API initialization warning:', error);
    }
};
// Initialize validation (non-blocking)
validateWebRiskAPI();
const SafeSearchUrlInputSchema = z.object({
    url: z.string().url().describe('The URL to check.'),
});
const SafeSearchUrlOutputSchema = z.object({
    isSafe: z.boolean().describe('Whether the URL is considered safe.'),
    threatTypes: z.array(z.string()).describe('The types of threats found, if any.'),
    details: z.string().describe('Details about the scan results.'),
});
export async function safeSearchUrl(input) {
    try {
        const request = {
            uri: input.url,
            threatTypes: [
                protos.google.cloud.webrisk.v1.ThreatType.MALWARE,
                protos.google.cloud.webrisk.v1.ThreatType.SOCIAL_ENGINEERING,
                protos.google.cloud.webrisk.v1.ThreatType.UNWANTED_SOFTWARE
            ],
        };
        const [response] = await client.searchUris(request);
        if (response.threat) {
            return {
                isSafe: false,
                threatTypes: response.threat.threatTypes?.map(t => protos.google.cloud.webrisk.v1.ThreatType[t]) || [],
                details: `The URL is considered unsafe. Threat types found: ${response.threat.threatTypes?.map(t => protos.google.cloud.webrisk.v1.ThreatType[t]).join(', ')}.`,
            };
        }
        else {
            return {
                isSafe: true,
                threatTypes: [],
                details: 'The URL is considered safe.',
            };
        }
    }
    catch (error) {
        console.error('[ERROR] Web Risk API call failed:', error);
        // Return conservative result (unsafe) when API fails
        return {
            isSafe: false,
            threatTypes: ['API_UNAVAILABLE'],
            details: 'Web Risk API unavailable - URL safety could not be verified',
        };
    }
}
//# sourceMappingURL=safe-search-url.js.map