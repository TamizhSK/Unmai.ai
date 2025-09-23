/**
 * @fileOverview Gets a credibility score for content.
 *
 * - getCredibilityScore - A function that gets a credibility score for content.
 * - GetCredibilityScoreInput - The input type for the getCredibilityScore function.
 * - GetCredibilityScoreOutput - The return type for the getCredibilityScore function.
 */
import { z } from 'zod';
declare const GetCredibilityScoreInputSchema: z.ZodObject<{
    content: z.ZodString;
    contentType: z.ZodEnum<["text", "image", "url"]>;
}, "strip", z.ZodTypeAny, {
    contentType: "text" | "url" | "image";
    content: string;
}, {
    contentType: "text" | "url" | "image";
    content: string;
}>;
export type GetCredibilityScoreInput = z.infer<typeof GetCredibilityScoreInputSchema>;
declare const GetCredibilityScoreOutputSchema: z.ZodObject<{
    credibilityScore: z.ZodNumber;
    assessmentSummary: z.ZodString;
    misleadingIndicators: z.ZodArray<z.ZodString, "many">;
    source: z.ZodString;
}, "strip", z.ZodTypeAny, {
    source: string;
    credibilityScore: number;
    assessmentSummary: string;
    misleadingIndicators: string[];
}, {
    source: string;
    credibilityScore: number;
    assessmentSummary: string;
    misleadingIndicators: string[];
}>;
export type GetCredibilityScoreOutput = z.infer<typeof GetCredibilityScoreOutputSchema>;
export declare function getCredibilityScore(input: GetCredibilityScoreInput): Promise<GetCredibilityScoreOutput>;
export {};
//# sourceMappingURL=get-credibility-score.d.ts.map