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

// OPTIMIZED UNIFIED ANALYSIS FUNCTION
export async function analyzeUnified(input: UnifiedAnalyzeInput, options?: { searchEngineId?: string }): Promise<UnifiedResponse> {
  console.log(`[INFO] Starting optimized ${input.type} analysis`);
  const startTime = Date.now();

  try {
    switch (input.type) {
      case 'text': {
        console.log(`[INFO] Processing text analysis (${input.payload.text.length} chars)`);
        const out = await analyzeTextContent({ text: input.payload.text }, options);
        const result = toUnified(out, `Analysis of text with ${out.claims?.length ?? 0} claims.`);
        console.log(`[INFO] Text analysis completed in ${Date.now() - startTime}ms`);
        return result;
      }
      
      case 'url': {
        console.log(`[INFO] Processing URL analysis: ${input.payload.url}`);
        const out = await analyzeUrlSafety({ url: input.payload.url }, options);
        const result = toUnified(out, `URL analysis for ${input.payload.url}.`);
        console.log(`[INFO] URL analysis completed in ${Date.now() - startTime}ms`);
        return result;
      }
      
      case 'image': {
        console.log(`[INFO] Processing image analysis (${input.payload.mimeType || 'unknown format'})`);
        const out = await analyzeImageContent({ 
          imageData: input.payload.imageData, 
          mimeType: input.payload.mimeType 
        }, options);
        const result = toUnified(out, 'Image analysis completed.');
        console.log(`[INFO] Image analysis completed in ${Date.now() - startTime}ms`);
        return result;
      }
      
      case 'video': {
        console.log(`[INFO] Processing video analysis (${input.payload.mimeType || 'unknown format'})`);
        const out = await analyzeVideoContent({ 
          videoData: input.payload.videoData, 
          mimeType: input.payload.mimeType 
        }, options);
        const result = toUnified(out, 'Video analysis completed.');
        console.log(`[INFO] Video analysis completed in ${Date.now() - startTime}ms`);
        return result;
      }
      
      case 'audio': {
        console.log(`[INFO] Processing audio analysis (${input.payload.mimeType || 'unknown format'})`);
        const out = await analyzeAudioContent({ 
          audioData: input.payload.audioData, 
          mimeType: input.payload.mimeType 
        }, options);
        const result = toUnified(out, 'Audio analysis completed.');
        console.log(`[INFO] Audio analysis completed in ${Date.now() - startTime}ms`);
        return result;
      }
      
      default: {
        // Exhaustive check with safe fallback
        throw new Error(`Unsupported input type: ${String((input as any)?.type)}`);
      }
    }
  } catch (error) {
    console.error(`[ERROR] ${input.type} analysis failed after ${Date.now() - startTime}ms:`, error);
    
    // Return appropriate error response based on content type
    const errorResponses = {
      text: {
        analysisLabel: 'RED' as const,
        oneLineDescription: 'Text analysis failed due to technical issues',
        summary: 'The text could not be analyzed. This may be due to processing limitations or invalid content format.',
        educationalInsight: 'When automated analysis fails, manually verify claims using trusted fact-checking websites and cross-reference with multiple sources.',
        sources: [{ url: 'https://www.snopes.com', title: 'Snopes Fact Checking', credibility: 0.95 }],
      },
      url: {
        analysisLabel: 'RED' as const,
        oneLineDescription: 'URL safety check failed due to technical issues',
        summary: 'The URL could not be analyzed for safety. Exercise extreme caution before visiting this link.',
        educationalInsight: 'When URL analysis fails, manually check the domain reputation, look for HTTPS, and verify through multiple URL scanners.',
        sources: [{ url: 'https://www.virustotal.com/gui/home/url', title: 'VirusTotal URL Scanner', credibility: 0.93 }],
      },
      image: {
        analysisLabel: 'RED' as const,
        oneLineDescription: 'Image analysis failed due to technical issues',
        summary: 'The image could not be processed. This may be due to unsupported format or corrupted data.',
        educationalInsight: 'When image analysis fails, use reverse image search tools and manually inspect for signs of manipulation or editing.',
        sources: [{ url: 'https://tineye.com', title: 'TinEye Reverse Image Search', credibility: 0.9 }],
      },
      video: {
        analysisLabel: 'RED' as const,
        oneLineDescription: 'Video analysis failed due to technical issues',
        summary: 'The video could not be processed. This may be due to unsupported format or file corruption.',
        educationalInsight: 'When video analysis fails, manually verify claims through reputable sources and look for signs of editing or deepfake manipulation.',
        sources: [{ url: 'https://www.reuters.com/fact-check', title: 'Reuters Fact Check', credibility: 0.94 }],
      },
      audio: {
        analysisLabel: 'RED' as const,
        oneLineDescription: 'Audio analysis failed due to technical issues',
        summary: 'The audio could not be processed. This may be due to unsupported format or transcription failure.',
        educationalInsight: 'When audio analysis fails, manually transcribe key claims and verify through trusted news sources and fact-checkers.',
        sources: [{ url: 'https://www.factcheck.org', title: 'FactCheck.org', credibility: 0.93 }],
      },
    };

    const errorResponse = errorResponses[input.type] || errorResponses.text;
    
    return toUnified({
      ...errorResponse,
      sourceIntegrityScore: 0,
      contentAuthenticityScore: 0,
      trustExplainabilityScore: 0,
    }, errorResponse.summary);
  }
}