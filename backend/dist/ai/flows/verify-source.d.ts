/**
 * @fileOverview Verifies the source of content.
 *
 * - verifySource - A function that verifies the source of content.
 * - VerifySourceInput - The input type for the verifySource function.
 * - VerifySourceOutput - The return type for the verifySource function.
 */
import { z } from 'zod';
declare const VerifySourceInputSchema: z.ZodObject<{
    content: z.ZodString;
    contentType: z.ZodEnum<["text", "url", "media"]>;
}, "strip", z.ZodTypeAny, {
    contentType: "text" | "url" | "media";
    content: string;
}, {
    contentType: "text" | "url" | "media";
    content: string;
}>;
export type VerifySourceInput = z.infer<typeof VerifySourceInputSchema>;
declare const VerifySourceOutputSchema: z.ZodObject<{
    sourceVerified: z.ZodBoolean;
    originTraced: z.ZodBoolean;
    sourceCredibility: z.ZodNumber;
    verificationDetails: z.ZodString;
    relatedSources: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
        similarity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        title: string;
        url: string;
        similarity: number;
    }, {
        title: string;
        url: string;
        similarity: number;
    }>, "many">;
    originalSource: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
        snippet: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        title: string;
        snippet: string;
        url: string;
    }, {
        title: string;
        snippet: string;
        url: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    sourceVerified: boolean;
    originTraced: boolean;
    sourceCredibility: number;
    verificationDetails: string;
    relatedSources: {
        title: string;
        url: string;
        similarity: number;
    }[];
    originalSource?: {
        title: string;
        snippet: string;
        url: string;
    } | undefined;
}, {
    sourceVerified: boolean;
    originTraced: boolean;
    sourceCredibility: number;
    verificationDetails: string;
    relatedSources: {
        title: string;
        url: string;
        similarity: number;
    }[];
    originalSource?: {
        title: string;
        snippet: string;
        url: string;
    } | undefined;
}>;
export type VerifySourceOutput = z.infer<typeof VerifySourceOutputSchema>;
export declare function verifySource(input: VerifySourceInput): Promise<VerifySourceOutput>;
export {};
//# sourceMappingURL=verify-source.d.ts.map