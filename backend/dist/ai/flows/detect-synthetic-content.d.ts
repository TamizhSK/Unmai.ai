/**
 * @fileOverview Detects synthetic content using SynthID technology.
 *
 * - detectSyntheticContent - A function that detects synthetic content using SynthID.
 * - DetectSyntheticContentInput - The input type for the detectSyntheticContent function.
 * - DetectSyntheticContentOutput - The return type for the detectSyntheticContent function.
 */
import { z } from 'zod';
declare const DetectSyntheticContentInputSchema: z.ZodObject<{
    media: z.ZodString;
    contentType: z.ZodEnum<["image", "video", "audio"]>;
}, "strip", z.ZodTypeAny, {
    contentType: "image" | "video" | "audio";
    media: string;
}, {
    contentType: "image" | "video" | "audio";
    media: string;
}>;
export type DetectSyntheticContentInput = z.infer<typeof DetectSyntheticContentInputSchema>;
declare const DetectSyntheticContentOutputSchema: z.ZodObject<{
    isSynthetic: z.ZodBoolean;
    confidenceScore: z.ZodNumber;
    analysis: z.ZodString;
    markersDetected: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    confidenceScore: number;
    analysis: string;
    isSynthetic: boolean;
    markersDetected: string[];
}, {
    confidenceScore: number;
    analysis: string;
    isSynthetic: boolean;
    markersDetected: string[];
}>;
export type DetectSyntheticContentOutput = z.infer<typeof DetectSyntheticContentOutputSchema>;
export declare function detectSyntheticContent(input: DetectSyntheticContentInput): Promise<DetectSyntheticContentOutput>;
export {};
//# sourceMappingURL=detect-synthetic-content.d.ts.map