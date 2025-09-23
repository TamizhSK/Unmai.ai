import { z } from 'zod';
export type InputType = 'text' | 'url' | 'image' | 'video' | 'audio';
export declare const UnifiedResponseSchema: z.ZodObject<{
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
}>;
export type UnifiedResponse = z.infer<typeof UnifiedResponseSchema>;
export type UnifiedAnalyzeInput = {
    type: 'text';
    payload: {
        text: string;
    };
} | {
    type: 'url';
    payload: {
        url: string;
    };
} | {
    type: 'image';
    payload: {
        imageData: string;
        mimeType?: string;
    };
} | {
    type: 'video';
    payload: {
        videoData: string;
        mimeType?: string;
    };
} | {
    type: 'audio';
    payload: {
        audioData: string;
        mimeType?: string;
    };
};
export declare function analyzeUnified(input: UnifiedAnalyzeInput, options?: {
    searchEngineId?: string;
}): Promise<UnifiedResponse>;
//# sourceMappingURL=unified-analysis.d.ts.map