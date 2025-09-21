/**
 * @fileOverview Analyzes content for potential misinformation.
 *
 * - analyzeContentForMisinformation - A function that analyzes content for misinformation.
 * - AnalyzeContentInput - The input type for the analyzeContentForMisinformation function.
 * - AnalyzeContentOutput - The return type for the analyzeContentForMisinformation function.
 */
import { z } from 'zod';
declare const AnalyzeContentInputSchema: z.ZodObject<{
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
export type AnalyzeContentInput = z.infer<typeof AnalyzeContentInputSchema>;
declare const AnalyzeContentOutputSchema: z.ZodObject<{
    misinformationPotential: z.ZodNumber;
    explanation: z.ZodString;
    sourceReliability: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    explanation: string;
    misinformationPotential: number;
    sourceReliability?: string | undefined;
}, {
    explanation: string;
    misinformationPotential: number;
    sourceReliability?: string | undefined;
}>;
export type AnalyzeContentOutput = z.infer<typeof AnalyzeContentOutputSchema>;
export declare function analyzeContentForMisinformation(input: AnalyzeContentInput): Promise<AnalyzeContentOutput>;
export {};
//# sourceMappingURL=analyze-content-for-misinformation.d.ts.map