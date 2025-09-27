/**
 * @fileOverview Performs web analysis for content.
 *
 * - performWebAnalysis - A function that performs web analysis for content.
 * - PerformWebAnalysisInput - The input type for the performWebAnalysis function.
 * - PerformWebAnalysisOutput - The return type for the performWebAnalysis function.
 */
import { z } from 'zod';
declare const PerformWebAnalysisInputSchema: z.ZodObject<{
    query: z.ZodString;
    contentType: z.ZodEnum<["text", "url"]>;
    searchEngineId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    contentType: "text" | "url";
    query: string;
    searchEngineId?: string | undefined;
}, {
    contentType: "text" | "url";
    query: string;
    searchEngineId?: string | undefined;
}>;
export type PerformWebAnalysisInput = z.infer<typeof PerformWebAnalysisInputSchema>;
declare const PerformWebAnalysisOutputSchema: z.ZodObject<{
    realTimeFactCheck: z.ZodBoolean;
    currentInformation: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        url: z.ZodString;
        snippet: z.ZodString;
        date: z.ZodString;
        relevance: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        title: string;
        snippet: string;
        url: string;
        relevance: number;
    }, {
        date: string;
        title: string;
        snippet: string;
        url: string;
        relevance: number;
    }>, "many">;
    informationGaps: z.ZodArray<z.ZodString, "many">;
    analysisSummary: z.ZodString;
}, "strip", z.ZodTypeAny, {
    realTimeFactCheck: boolean;
    currentInformation: {
        date: string;
        title: string;
        snippet: string;
        url: string;
        relevance: number;
    }[];
    informationGaps: string[];
    analysisSummary: string;
}, {
    realTimeFactCheck: boolean;
    currentInformation: {
        date: string;
        title: string;
        snippet: string;
        url: string;
        relevance: number;
    }[];
    informationGaps: string[];
    analysisSummary: string;
}>;
export type PerformWebAnalysisOutput = z.infer<typeof PerformWebAnalysisOutputSchema>;
export declare function performWebAnalysis(input: PerformWebAnalysisInput): Promise<PerformWebAnalysisOutput>;
export {};
//# sourceMappingURL=perform-web-analysis.d.ts.map