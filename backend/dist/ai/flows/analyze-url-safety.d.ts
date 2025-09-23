import { z } from 'zod';
declare const UrlAnalysisInputSchema: z.ZodObject<{
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
}, {
    url: string;
}>;
export type UrlAnalysisInput = z.infer<typeof UrlAnalysisInputSchema>;
declare const UrlAnalysisOutputSchema: z.ZodObject<{
    analysisLabel: z.ZodEnum<["RED", "YELLOW", "ORANGE", "GREEN"]>;
    oneLineDescription: z.ZodString;
    summary: z.ZodString;
    educationalInsight: z.ZodString;
    sources: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
        credibility: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        title: string;
        url: string;
        credibility: number;
    }, {
        title: string;
        url: string;
        credibility: number;
    }>, "many">;
    sourceIntegrityScore: z.ZodNumber;
    contentAuthenticityScore: z.ZodNumber;
    trustExplainabilityScore: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodObject<{
        domain: z.ZodOptional<z.ZodString>;
        threats: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        isSafe: z.ZodOptional<z.ZodBoolean>;
        reputationScore: z.ZodOptional<z.ZodNumber>;
        ageDays: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        domain?: string | undefined;
        threats?: string[] | undefined;
        isSafe?: boolean | undefined;
        reputationScore?: number | undefined;
        ageDays?: number | undefined;
    }, {
        domain?: string | undefined;
        threats?: string[] | undefined;
        isSafe?: boolean | undefined;
        reputationScore?: number | undefined;
        ageDays?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    oneLineDescription: string;
    summary: string;
    educationalInsight: string;
    sources: {
        title: string;
        url: string;
        credibility: number;
    }[];
    analysisLabel: "RED" | "YELLOW" | "ORANGE" | "GREEN";
    sourceIntegrityScore: number;
    contentAuthenticityScore: number;
    trustExplainabilityScore: number;
    metadata?: {
        domain?: string | undefined;
        threats?: string[] | undefined;
        isSafe?: boolean | undefined;
        reputationScore?: number | undefined;
        ageDays?: number | undefined;
    } | undefined;
}, {
    oneLineDescription: string;
    summary: string;
    educationalInsight: string;
    sources: {
        title: string;
        url: string;
        credibility: number;
    }[];
    analysisLabel: "RED" | "YELLOW" | "ORANGE" | "GREEN";
    sourceIntegrityScore: number;
    contentAuthenticityScore: number;
    trustExplainabilityScore: number;
    metadata?: {
        domain?: string | undefined;
        threats?: string[] | undefined;
        isSafe?: boolean | undefined;
        reputationScore?: number | undefined;
        ageDays?: number | undefined;
    } | undefined;
}>;
export type UrlAnalysisOutput = z.infer<typeof UrlAnalysisOutputSchema>;
export declare function analyzeUrlSafety(input: UrlAnalysisInput, options?: {
    searchEngineId?: string;
}): Promise<UrlAnalysisOutput>;
export {};
//# sourceMappingURL=analyze-url-safety.d.ts.map