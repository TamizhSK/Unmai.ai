/**
 * @fileOverview Detects deepfake content in images and videos.
 *
 * - detectDeepfake - A function that detects deepfake content.
 * - DetectDeepfakeInput - The input type for the detectDeepfake function.
 * - DetectDeepfakeOutput - The return type for the detectDeepfake function.
 */
import { z } from 'zod';
declare const DetectDeepfakeInputSchema: z.ZodObject<{
    media: z.ZodString;
    contentType: z.ZodEnum<["image", "video", "audio"]>;
}, "strip", z.ZodTypeAny, {
    contentType: "image" | "video" | "audio";
    media: string;
}, {
    contentType: "image" | "video" | "audio";
    media: string;
}>;
export type DetectDeepfakeInput = z.infer<typeof DetectDeepfakeInputSchema>;
declare const DetectDeepfakeOutputSchema: z.ZodObject<{
    isDeepfake: z.ZodBoolean;
    confidenceScore: z.ZodNumber;
    analysis: z.ZodString;
    visionApiAnalysis: z.ZodOptional<z.ZodObject<{
        safeSearchResult: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        safeSearchResult: string;
    }, {
        safeSearchResult: string;
    }>>;
    videoIntelligenceAnalysis: z.ZodOptional<z.ZodObject<{
        faceDetection: z.ZodString;
        shotChange: z.ZodString;
        labelDetection: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        faceDetection: string;
        shotChange: string;
        labelDetection: string;
    }, {
        faceDetection: string;
        shotChange: string;
        labelDetection: string;
    }>>;
    synthIdAnalysis: z.ZodOptional<z.ZodObject<{
        isSynthetic: z.ZodBoolean;
        confidence: z.ZodNumber;
        details: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        isSynthetic: boolean;
        confidence: number;
        details: string;
    }, {
        isSynthetic: boolean;
        confidence: number;
        details: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    isDeepfake: boolean;
    confidenceScore: number;
    analysis: string;
    visionApiAnalysis?: {
        safeSearchResult: string;
    } | undefined;
    videoIntelligenceAnalysis?: {
        faceDetection: string;
        shotChange: string;
        labelDetection: string;
    } | undefined;
    synthIdAnalysis?: {
        isSynthetic: boolean;
        confidence: number;
        details: string;
    } | undefined;
}, {
    isDeepfake: boolean;
    confidenceScore: number;
    analysis: string;
    visionApiAnalysis?: {
        safeSearchResult: string;
    } | undefined;
    videoIntelligenceAnalysis?: {
        faceDetection: string;
        shotChange: string;
        labelDetection: string;
    } | undefined;
    synthIdAnalysis?: {
        isSynthetic: boolean;
        confidence: number;
        details: string;
    } | undefined;
}>;
export type DetectDeepfakeOutput = z.infer<typeof DetectDeepfakeOutputSchema>;
export declare function detectDeepfake(input: DetectDeepfakeInput, sourceCredibility?: number): Promise<DetectDeepfakeOutput>;
export {};
//# sourceMappingURL=detect-deepfake.d.ts.map