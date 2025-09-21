/**
 * @fileOverview Transcribes audio content using Google Cloud Speech API.
 *
 * - transcribeAudioFlow - A function that transcribes audio content.
 * - TranscribeAudioInput - The input type for the transcribeAudioFlow function.
 * - TranscribeAudioOutput - The return type for the transcribeAudioFlow function.
 */
import { z } from 'zod';
declare const TranscribeAudioInputSchema: z.ZodObject<{
    audioData: z.ZodString;
}, "strip", z.ZodTypeAny, {
    audioData: string;
}, {
    audioData: string;
}>;
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;
declare const TranscribeAudioOutputSchema: z.ZodObject<{
    transcription: z.ZodString;
    confidence: z.ZodNumber;
    language: z.ZodString;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    transcription: string;
    language: string;
}, {
    confidence: number;
    transcription: string;
    language: string;
}>;
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;
export declare const transcribeAudioFlow: (input: TranscribeAudioInput) => Promise<TranscribeAudioOutput>;
export {};
//# sourceMappingURL=transcribe-audio.d.ts.map