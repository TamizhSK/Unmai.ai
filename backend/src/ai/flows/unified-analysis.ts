import { z } from 'zod';
import { analyzeTextContent } from './analyze-text-content.js';
import { analyzeUrlSafety } from './analyze-url-safety.js';
import { analyzeImageContent } from './analyze-image-content.js';
import { analyzeVideoContent } from './analyze-video-content.js';
import { analyzeAudioContent } from './analyze-audio-content.js';

// Supported input types
export type InputType = 'text' | 'url' | 'image' | 'video' | 'audio';

// Unified response format to match the UI card
export const UnifiedResponseSchema = z.object({
  analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']),
  oneLineDescription: z.string(),
  summary: z.string(),
  educationalInsight: z.string(),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    credibility: z.number().min(0).max(1),
  })),
  sourceIntegrityScore: z.number().min(0).max(100),
  contentAuthenticityScore: z.number().min(0).max(100),
  trustExplainabilityScore: z.number().min(0).max(100),
});
export type UnifiedResponse = z.infer<typeof UnifiedResponseSchema>;

export type UnifiedAnalyzeInput =
  | { type: 'text'; payload: { text: string } }
  | { type: 'url'; payload: { url: string } }
  | { type: 'image'; payload: { imageData: string; mimeType?: string } }
  | { type: 'video'; payload: { videoData: string; mimeType?: string } }
  | { type: 'audio'; payload: { audioData: string; mimeType?: string } };

function toOneLine(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 160 ? line.slice(0, 157) + '…' : line;
}

function toUnified(
  args: {
    analysisLabel?: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
    oneLineDescription?: string;
    summary?: string;
    educationalInsight?: string;
    sourceIntegrityScore?: number;
    contentAuthenticityScore?: number;
    trustExplainabilityScore?: number;
    sources?: Array<{ url: string; title: string; credibility: number }>;
  },
  fallbackOneLiner: string
): UnifiedResponse {
  const analysisLabel = args.analysisLabel ?? 'YELLOW';
  const summary = args.summary ?? fallbackOneLiner;
  const educationalInsight = args.educationalInsight ?? 'No educational insight available.';
  const sources = args.sources ?? [];
  const sourceIntegrityScore = Math.round(args.sourceIntegrityScore ?? 60);
  const contentAuthenticityScore = Math.round(args.contentAuthenticityScore ?? 60);
  const trustExplainabilityScore = Math.round(args.trustExplainabilityScore ?? 60);
  const oneLineDescription = args.oneLineDescription ? toOneLine(args.oneLineDescription) : toOneLine(summary);
  return UnifiedResponseSchema.parse({
    analysisLabel,
    oneLineDescription,
    summary,
    educationalInsight,
    sources,
    sourceIntegrityScore,
    contentAuthenticityScore,
    trustExplainabilityScore,
  });
}

export async function analyzeUnified(input: UnifiedAnalyzeInput): Promise<UnifiedResponse> {
  switch (input.type) {
    case 'text': {
      const out = await analyzeTextContent({ text: input.payload.text });
      return toUnified(out, `Analysis of text with ${out.claims?.length ?? 0} claims.`);
    }
    case 'url': {
      const out = await analyzeUrlSafety({ url: input.payload.url });
      return toUnified(out, `URL analysis for ${input.payload.url}.`);
    }
    case 'image': {
      const out = await analyzeImageContent({ imageData: input.payload.imageData, mimeType: input.payload.mimeType });
      return toUnified(out, 'Image analysis completed.');
    }
    case 'video': {
      const out = await analyzeVideoContent({ videoData: input.payload.videoData, mimeType: input.payload.mimeType });
      return toUnified(out, 'Video analysis completed.');
    }
    case 'audio': {
      const out = await analyzeAudioContent({ audioData: input.payload.audioData, mimeType: input.payload.mimeType });
      return toUnified(out, 'Audio analysis completed.');
    }
    default: {
      // Exhaustive check with safe fallback
      throw new Error(`Unsupported input type: ${String((input as any)?.type)}`);
    }
  }
}
