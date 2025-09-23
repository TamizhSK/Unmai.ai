'use client';

import { useState } from 'react';
import {
  analyzeUnified,
  verifySource,
  translateText
} from '@/lib/simple-api-client';
import { useToast } from '@/hooks/use-toast';

export type AnalysisTask = 'url-analysis' | 'text-analysis' | 'image-analysis' | 'video-analysis' | 'audio-analysis';

type AiMessage = {
  type: 'ai';
  task: AnalysisTask;
  result: any;
  sourceResult?: any;
};

export function useAnalysis() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const performAnalysis = async (
    input: string,
    file: { dataUrl: string, type: string } | null,
    language: string,
    addMessage: (message: any) => void,
    removeLastMessage: () => void
  ) => {
    setIsLoading(true);

    try {
      let currentInput = input;
      const currentFile = file;

      let originalLanguage = language;
      if (language !== 'en-US' && currentInput && typeof currentInput === 'string') {
        try {
          const translatedText = await translateText(currentInput, 'en-US');
          currentInput = typeof translatedText === 'string' ? translatedText : currentInput;
        } catch (translationError) {
          console.error("Input translation failed:", translationError);
          toast({
            title: "Translation Failed",
            description: "Could not translate your text. Please try again.",
            variant: "destructive",
          });
          removeLastMessage();
          return;
        }
      }

      let contentType: 'text' | 'url' | 'image' | 'video' | 'audio' = 'text';
      if (currentFile) {
        if (currentFile.type.startsWith('image/')) contentType = 'image';
        else if (currentFile.type.startsWith('video/')) contentType = 'video';
        else if (currentFile.type.startsWith('audio/')) contentType = 'audio';
      } else if (currentInput.match(/^https?:\/\//)) {
        contentType = 'url';
      }

      const task: AnalysisTask =
        contentType === 'url' ? 'url-analysis' :
        contentType === 'image' ? 'image-analysis' :
        contentType === 'video' ? 'video-analysis' :
        contentType === 'audio' ? 'audio-analysis' :
        'text-analysis';

      let result: any;
      let sourceResult: any;

      // Build payload for unified analyzer
      const buildPayload = () => {
        if (contentType === 'text') return { text: currentInput };
        if (contentType === 'url') return { url: currentInput };
        if (currentFile && (contentType === 'image' || contentType === 'video' || contentType === 'audio')) {
          const dataKey = contentType === 'image' ? 'imageData' : contentType === 'video' ? 'videoData' : 'audioData';
          return { [dataKey]: currentFile.dataUrl, mimeType: currentFile.type } as any;
        }
        return { text: currentInput };
      };

      const searchEngineId = process.env.NEXT_PUBLIC_CUSTOM_SEARCH_ENGINE_ID;

      // Call unified backend for primary analysis
      result = await analyzeUnified(contentType, buildPayload(), searchEngineId);

      // Optional enrichment for URL: verify source and safe search (presented in UI via sourceResult)
      if (contentType === 'url') {
        try {
          const [verifySourceResult] = await Promise.all([
            verifySource(currentInput, 'url')
            // safeSearchUrl can still be inspected from result if unified analyzer returns it; keep lightweight here
          ]);
          sourceResult = verifySourceResult;
        } catch (e) {
          console.warn('Optional source verification failed:', e);
        }
      }

      if (originalLanguage !== 'en-US' && result) {
        const fieldsToTranslate = ['summary', 'explanation', 'claim', 'evidence'];
        for (const field of fieldsToTranslate) {
          if (result[field] && typeof result[field] === 'string') {
            try {
              result[field] = await translateText(result[field], originalLanguage);
            } catch (translationError) {
              console.error(`Translation failed for field ${field}:`, translationError);
              // Keep original text if translation fails
            }
          }
        }
      }

      const aiMessage: AiMessage = { type: 'ai', task, result, sourceResult };
      addMessage(aiMessage);

    } catch (e: any) {
      let description = "An error occurred during analysis. Please check your input or try again later.";
      if (e.message?.includes('503') || e.message?.includes('overloaded')) {
        description = "The analysis service is currently experiencing high demand. Please try again in a few moments.";
      } else if (e.message?.includes('429') || e.message?.includes('quota')) {
        description = "You've exceeded the request limit. Please wait a bit before trying again.";
      }
      toast({ title: "Analysis Failed", description, variant: "destructive" });
      removeLastMessage();
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, performAnalysis };
}
