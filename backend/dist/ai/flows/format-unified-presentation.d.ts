import { z } from 'zod';
declare const PresentationSchema: z.ZodObject<{
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
}, "strip", z.ZodTypeAny, {
    oneLineDescription: string;
    summary: string;
    educationalInsight: string;
    sources: {
        title: string;
        url: string;
        credibility: number;
    }[];
}, {
    oneLineDescription: string;
    summary: string;
    educationalInsight: string;
    sources: {
        title: string;
        url: string;
        credibility: number;
    }[];
}>;
export type Presentation = z.infer<typeof PresentationSchema>;
export declare function formatUnifiedPresentation(input: {
    contentType: 'text' | 'url' | 'image' | 'video' | 'audio';
    analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
    rawSignals: Record<string, any>;
    candidateSources: Array<{
        url: string;
        title?: string;
        snippet?: string;
        relevance?: number;
    }>;
}): Promise<Presentation>;
export {};
//# sourceMappingURL=format-unified-presentation.d.ts.map