/**
 * @fileOverview Performs a safe search check on a URL using the Google Web Risk API.
 *
 * - safeSearchUrl - A function that checks a URL against Google's safe browsing lists.
 * - SafeSearchUrlInput - The input type for the safeSearchUrl function.
 * - SafeSearchUrlOutput - The return type for the safeSearchUrl function.
 */
import { z } from 'zod';
declare const SafeSearchUrlInputSchema: z.ZodObject<{
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
}, {
    url: string;
}>;
export type SafeSearchUrlInput = z.infer<typeof SafeSearchUrlInputSchema>;
declare const SafeSearchUrlOutputSchema: z.ZodObject<{
    isSafe: z.ZodBoolean;
    threatTypes: z.ZodArray<z.ZodString, "many">;
    details: z.ZodString;
}, "strip", z.ZodTypeAny, {
    isSafe: boolean;
    threatTypes: string[];
    details: string;
}, {
    isSafe: boolean;
    threatTypes: string[];
    details: string;
}>;
export type SafeSearchUrlOutput = z.infer<typeof SafeSearchUrlOutputSchema>;
export declare function safeSearchUrl(input: SafeSearchUrlInput): Promise<SafeSearchUrlOutput>;
export {};
//# sourceMappingURL=safe-search-url.d.ts.map