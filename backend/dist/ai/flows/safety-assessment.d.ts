/**
 * @fileOverview Assesses the safety of content.
 *
 * - assessSafety - A function that assesses the safety of content.
 * - AssessSafetyInput - The input type for the assessSafety function.
 * - AssessSafetyOutput - The return type for the assessSafety function.
 */
import { z } from 'zod';
declare const SafetyAssessmentInputSchema: z.ZodObject<{
    content: z.ZodString;
    contentType: z.ZodEnum<["text", "image", "url"]>;
}, "strip", z.ZodTypeAny, {
    contentType: "text" | "url" | "image";
    content: string;
}, {
    contentType: "text" | "url" | "image";
    content: string;
}>;
declare const SafetyAssessmentOutputSchema: z.ZodObject<{
    safetyRating: z.ZodEnum<["SAFE", "HARMFUL", "MISLEADING", "UNKNOWN"]>;
    confidenceScore: z.ZodNumber;
    explanation: z.ZodString;
    topics: z.ZodArray<z.ZodString, "many">;
    contentAnalysis: z.ZodString;
}, "strip", z.ZodTypeAny, {
    explanation: string;
    confidenceScore: number;
    safetyRating: "UNKNOWN" | "SAFE" | "HARMFUL" | "MISLEADING";
    topics: string[];
    contentAnalysis: string;
}, {
    explanation: string;
    confidenceScore: number;
    safetyRating: "UNKNOWN" | "SAFE" | "HARMFUL" | "MISLEADING";
    topics: string[];
    contentAnalysis: string;
}>;
export declare function assessSafety(input: z.infer<typeof SafetyAssessmentInputSchema>): Promise<z.infer<typeof SafetyAssessmentOutputSchema>>;
export {};
//# sourceMappingURL=safety-assessment.d.ts.map