import { z } from 'zod';
declare const ImageAnalysisInputSchema: z.ZodObject<{
    imageData: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    imageData: string;
    mimeType?: string | undefined;
}, {
    imageData: string;
    mimeType?: string | undefined;
}>;
export type ImageAnalysisInput = z.infer<typeof ImageAnalysisInputSchema>;
declare const ImageAnalysisOutputSchema: z.ZodObject<{
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
        author: z.ZodOptional<z.ZodString>;
        location: z.ZodOptional<z.ZodString>;
        ocrText: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        isManipulated: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        creationDate?: string | undefined;
        author?: string | undefined;
        location?: string | undefined;
        ocrText?: string | undefined;
        description?: string | undefined;
        isManipulated?: boolean | undefined;
    }, {
        creationDate?: string | undefined;
        author?: string | undefined;
        location?: string | undefined;
        ocrText?: string | undefined;
        description?: string | undefined;
        isManipulated?: boolean | undefined;
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
        author?: string | undefined;
        location?: string | undefined;
        ocrText?: string | undefined;
        description?: string | undefined;
        isManipulated?: boolean | undefined;
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
        author?: string | undefined;
        location?: string | undefined;
        ocrText?: string | undefined;
        description?: string | undefined;
        isManipulated?: boolean | undefined;
    } | undefined;
}>;
export type ImageAnalysisOutput = z.infer<typeof ImageAnalysisOutputSchema>;
export declare function analyzeImageContent(input: ImageAnalysisInput): Promise<ImageAnalysisOutput>;
export {};
//# sourceMappingURL=analyze-image-content.d.ts.map