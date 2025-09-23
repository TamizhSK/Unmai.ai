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
        creationDate: z.ZodOptional<z.ZodString>;
        device: z.ZodOptional<z.ZodString>;
        location: z.ZodOptional<z.ZodString>;
        transcription: z.ZodOptional<z.ZodString>;
        events: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        isManipulated: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        creationDate?: string | undefined;
        location?: string | undefined;
        isManipulated?: boolean | undefined;
        device?: string | undefined;
        transcription?: string | undefined;
        events?: string[] | undefined;
    }, {
        creationDate?: string | undefined;
        location?: string | undefined;
        isManipulated?: boolean | undefined;
        device?: string | undefined;
        transcription?: string | undefined;
        events?: string[] | undefined;
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
        creationDate?: string | undefined;
        location?: string | undefined;
        isManipulated?: boolean | undefined;
        device?: string | undefined;
        transcription?: string | undefined;
        events?: string[] | undefined;
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
        creationDate?: string | undefined;
        location?: string | undefined;
        isManipulated?: boolean | undefined;
        device?: string | undefined;
        transcription?: string | undefined;
        events?: string[] | undefined;
    } | undefined;
}>;
export type VideoAnalysisOutput = z.infer<typeof VideoAnalysisOutputSchema>;
export declare function analyzeVideoContent(input: VideoAnalysisInput): Promise<VideoAnalysisOutput>;
export {};
//# sourceMappingURL=analyze-video-content.d.ts.map