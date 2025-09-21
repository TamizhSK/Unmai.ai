/**
 * @fileOverview Explains misleading indicators in content. be misleading.
 *
 * - explainMisleadingIndicators - A function that explains misleading indicators.
 * - ExplainMisleadingIndicatorsInput - The input type for the explainMisleadingIndicators function.
 * - ExplainMisleadingIndicatorsOutput - The return type for the explainMisleadingIndicators function.
 */
import { z } from 'zod';
declare const ExplainMisleadingIndicatorsInputSchema: z.ZodObject<{
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
export type ExplainMisleadingIndicatorsInput = z.infer<typeof ExplainMisleadingIndicatorsInputSchema>;
declare const ExplainMisleadingIndicatorsOutputSchema: z.ZodObject<{
    explanation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    explanation: string;
}, {
    explanation: string;
}>;
export type ExplainMisleadingIndicatorsOutput = z.infer<typeof ExplainMisleadingIndicatorsOutputSchema>;
export declare function explainMisleadingIndicators(input: ExplainMisleadingIndicatorsInput): Promise<ExplainMisleadingIndicatorsOutput>;
export {};
//# sourceMappingURL=explain-misleading-indicators.d.ts.map