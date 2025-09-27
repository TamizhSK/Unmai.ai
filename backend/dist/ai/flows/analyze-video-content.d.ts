import { z } from 'zod';
declare const VideoAnalysisInputSchema: z.ZodObject<{
    videoData: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    videoData: string;
    mimeType?: string | undefined;
}, {
    videoData: string;
    mimeType?: string | undefined;
}>;
export type VideoAnalysisInput = z.infer<typeof VideoAnalysisInputSchema>;
declare const VideoAnalysisOutputSchema: z.ZodObject<{
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
        location: z.ZodOptional<z.ZodString>;
        transcription: z.ZodOptional<z.ZodString>;
        events: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        isManipulated: z.ZodOptional<z.ZodBoolean>;
        technicalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        location?: string | undefined;
        isManipulated?: boolean | undefined;
        transcription?: string | undefined;
        events?: string[] | undefined;
        technicalData?: Record<string, unknown> | undefined;
    }, {
        location?: string | undefined;
        isManipulated?: boolean | undefined;
        transcription?: string | undefined;
        events?: string[] | undefined;
        technicalData?: Record<string, unknown> | undefined;
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
        location?: string | undefined;
        isManipulated?: boolean | undefined;
        transcription?: string | undefined;
        events?: string[] | undefined;
        technicalData?: Record<string, unknown> | undefined;
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
        location?: string | undefined;
        isManipulated?: boolean | undefined;
        transcription?: string | undefined;
        events?: string[] | undefined;
        technicalData?: Record<string, unknown> | undefined;
    } | undefined;
}>;
export type VideoAnalysisOutput = z.infer<typeof VideoAnalysisOutputSchema>;
export declare function analyzeVideoContent(input: VideoAnalysisInput, options?: {
    searchEngineId?: string;
}): Promise<VideoAnalysisOutput>;
export {};
//# sourceMappingURL=analyze-video-content.d.ts.map