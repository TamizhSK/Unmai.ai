/**
 * @fileOverview Fact-checks a claim.
 *
 * - factCheckClaim - A function that fact-checks a claim.
 * - FactCheckClaimInput - The input type for the factCheckClaim function.
 * - FactCheckClaimOutput - The return type for the factCheckClaim function.
 */
import { z } from 'zod';
declare const FactCheckClaimInputSchema: z.ZodObject<{
    claim: z.ZodString;
}, "strip", z.ZodTypeAny, {
    claim: string;
}, {
    claim: string;
}>;
export type FactCheckClaimInput = z.infer<typeof FactCheckClaimInputSchema>;
declare const FactCheckClaimOutputSchema: z.ZodObject<{
    verdict: z.ZodEnum<["True", "False", "Misleading", "Uncertain"]>;
    evidence: z.ZodArray<z.ZodObject<{
        source: z.ZodString;
        title: z.ZodString;
        snippet: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source: string;
        title: string;
        snippet: string;
    }, {
        source: string;
        title: string;
        snippet: string;
    }>, "many">;
    explanation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    verdict: "True" | "False" | "Misleading" | "Uncertain";
    evidence: {
        source: string;
        title: string;
        snippet: string;
    }[];
    explanation: string;
}, {
    verdict: "True" | "False" | "Misleading" | "Uncertain";
    evidence: {
        source: string;
        title: string;
        snippet: string;
    }[];
    explanation: string;
}>;
export type FactCheckClaimOutput = z.infer<typeof FactCheckClaimOutputSchema>;
export declare function factCheckClaim(input: FactCheckClaimInput): Promise<FactCheckClaimOutput>;
export {};
//# sourceMappingURL=fact-check-claim.d.ts.map