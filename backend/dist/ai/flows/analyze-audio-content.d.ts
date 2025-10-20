import { z } from 'zod';
declare const AudioAnalysisInputSchema: z.ZodObject<{
    audioData: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    audioData: string;
    mimeType?: string | undefined;
}, {
    audioData: string;
    mimeType?: string | undefined;
}>;
export type AudioAnalysisInput = z.infer<typeof AudioAnalysisInputSchema>;
declare const AudioAnalysisOutputSchema: z.ZodObject<{
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
        format: z.ZodOptional<z.ZodString>;
        duration: z.ZodOptional<z.ZodNumber>;
        bitrate: z.ZodOptional<z.ZodNumber>;
        transcription: z.ZodOptional<z.ZodString>;
        factualClaims: z.ZodOptional<z.ZodArray<z.ZodObject<{
            claim: z.ZodString;
            verdict: z.ZodEnum<["VERIFIED", "DISPUTED", "UNVERIFIED"]>;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            claim: string;
            verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
            confidence: number;
        }, {
            claim: string;
            verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
            confidence: number;
        }>, "many">>;
        guidedQueries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        factualClaims?: {
            claim: string;
            verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
            confidence: number;
        }[] | undefined;
        transcription?: string | undefined;
        guidedQueries?: string[] | undefined;
        format?: string | undefined;
        duration?: number | undefined;
        bitrate?: number | undefined;
    }, {
        factualClaims?: {
            claim: string;
            verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
            confidence: number;
        }[] | undefined;
        transcription?: string | undefined;
        guidedQueries?: string[] | undefined;
        format?: string | undefined;
        duration?: number | undefined;
        bitrate?: number | undefined;
    }>>;
    deepAnalysis: z.ZodOptional<z.ZodObject<{
        what: z.ZodString;
        how: z.ZodString;
        why: z.ZodString;
        when: z.ZodString;
        educationalInsights: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        what: string;
        how: string;
        why: string;
        when: string;
        educationalInsights: string[];
    }, {
        what: string;
        how: string;
        why: string;
        when: string;
        educationalInsights: string[];
    }>>;
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
    metadata?: {
        factualClaims?: {
            claim: string;
            verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
            confidence: number;
        }[] | undefined;
        transcription?: string | undefined;
        guidedQueries?: string[] | undefined;
        format?: string | undefined;
        duration?: number | undefined;
        bitrate?: number | undefined;
    } | undefined;
    deepAnalysis?: {
        what: string;
        how: string;
        why: string;
        when: string;
        educationalInsights: string[];
    } | undefined;
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
    metadata?: {
        factualClaims?: {
            claim: string;
            verdict: "VERIFIED" | "DISPUTED" | "UNVERIFIED";
            confidence: number;
        }[] | undefined;
        transcription?: string | undefined;
        guidedQueries?: string[] | undefined;
        format?: string | undefined;
        duration?: number | undefined;
        bitrate?: number | undefined;
    } | undefined;
    deepAnalysis?: {
        what: string;
        how: string;
        why: string;
        when: string;
        educationalInsights: string[];
    } | undefined;
}>;
export type AudioAnalysisOutput = z.infer<typeof AudioAnalysisOutputSchema>;
export declare function analyzeAudioContent(input: AudioAnalysisInput, options?: {
    searchEngineId?: string;
}): Promise<AudioAnalysisOutput>;
export {};
//# sourceMappingURL=analyze-audio-content.d.ts.map