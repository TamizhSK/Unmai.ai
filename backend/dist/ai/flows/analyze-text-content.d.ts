import { z } from 'zod';
declare const TextAnalysisInputSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
export type TextAnalysisInput = z.infer<typeof TextAnalysisInputSchema>;
declare const TextAnalysisOutputSchema: z.ZodObject<{
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
    claims: z.ZodOptional<z.ZodArray<z.ZodObject<{
        claim: z.ZodString;
        verdict: z.ZodEnum<["VERIFIED", "DISPUTED", "UNVERIFIED"]>;
        confidence: z.ZodNumber;
        explanation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        claim: string;
        verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
        explanation: string;
        confidence: number;
    }, {
        claim: string;
        verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
        explanation: string;
        confidence: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    analysisLabel: "RED" | "YELLOW" | "ORANGE" | "GREEN";
    oneLineDescription: string;
    summary: string;
    educationalInsight: string;
    sources: {
        title: string;
        url: string;
        credibility: number;
    }[];
    sourceIntegrityScore: number;
    contentAuthenticityScore: number;
    trustExplainabilityScore: number;
    claims?: {
        claim: string;
        verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
        explanation: string;
        confidence: number;
    }[] | undefined;
}, {
    analysisLabel: "RED" | "YELLOW" | "ORANGE" | "GREEN";
    oneLineDescription: string;
    summary: string;
    educationalInsight: string;
    sources: {
        title: string;
        url: string;
        credibility: number;
    }[];
    sourceIntegrityScore: number;
    contentAuthenticityScore: number;
    trustExplainabilityScore: number;
    claims?: {
        claim: string;
        verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
        explanation: string;
        confidence: number;
    }[] | undefined;
}>;
export type TextAnalysisOutput = z.infer<typeof TextAnalysisOutputSchema>;
export declare function analyzeTextContent(input: TextAnalysisInput): Promise<TextAnalysisOutput>;
export {};
//# sourceMappingURL=analyze-text-content.d.ts.map