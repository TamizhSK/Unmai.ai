/**
 * @fileOverview Provides educational insights about content.
 *
 * - provideEducationalInsights - A function that provides educational insights for content.
 * - ProvideEducationalInsightsInput - The input type for the provideEducationalInsights function.
 * - ProvideEducationalInsightsOutput - The return type for the provideEducationalInsights function.
 */
import { z } from 'zod';
declare const ProvideEducationalInsightsInputSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
export type ProvideEducationalInsightsInput = z.infer<typeof ProvideEducationalInsightsInputSchema>;
declare const ProvideEducationalInsightsOutputSchema: z.ZodObject<{
    insights: z.ZodString;
}, "strip", z.ZodTypeAny, {
    insights: string;
}, {
    insights: string;
}>;
export type ProvideEducationalInsightsOutput = z.infer<typeof ProvideEducationalInsightsOutputSchema>;
export declare function provideEducationalInsights(input: ProvideEducationalInsightsInput): Promise<ProvideEducationalInsightsOutput>;
export {};
//# sourceMappingURL=provide-educational-insights.d.ts.map