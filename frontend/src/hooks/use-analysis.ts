'use client';

import { useState } from 'react';
import {
  detectDeepfake,
  provideEducationalInsights,
  assessSafety,
  verifySource,
  performWebAnalysis,
  detectSyntheticContent,
  analyzeContentForMisinformation,
  safeSearchUrl,
  factCheckClaim,
  transcribeAudioFlow,
  translateText
} from '@/lib/simple-api-client';
import { useToast } from '@/hooks/use-toast';

export type AnalysisTask = 'credibility' | 'deepfake' | 'insights' | 'safety' | 'verify-source' | 'web-analysis' | 'synthetic-content' | 'misinformation' | 'safe-search' | 'fact-check' | 'url-analysis';

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
      let currentFile = file;

      if (currentFile && currentFile.type.startsWith('audio/')) {
        try {
          const base64Data = currentFile.dataUrl.split(',')[1];
          const transcriptionResult = await transcribeAudioFlow(base64Data);
          // Handle both string and object responses
          currentInput = typeof transcriptionResult === 'string' 
            ? transcriptionResult 
            : (transcriptionResult as any)?.transcription || (transcriptionResult as any)?.text || '';
          currentFile = null;
        } catch (transcriptionError) {
          console.error("Transcription failed:", transcriptionError);
          toast({
            title: "Audio Transcription Failed",
            description: "Could not process the audio. Please try again.",
            variant: "destructive",
          });
          removeLastMessage();
          return;
        }
      }

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

      let contentType: 'text' | 'url' | 'image' | 'video' = 'text';
      if (currentFile) {
        if (currentFile.type.startsWith('image/')) contentType = 'image';
        else if (currentFile.type.startsWith('video/')) contentType = 'video';
      } else if (currentInput.match(/^https?:\/\//)) {
        contentType = 'url';
      }

      let task: AnalysisTask;
      if (contentType === 'url') {
        task = 'url-analysis';
      } else if (contentType === 'image' || contentType === 'video') {
        task = currentInput.toLowerCase().includes('synthetic') || currentInput.toLowerCase().includes('ai-generated')
          ? 'synthetic-content'
          : 'deepfake';
      } else if (currentInput.toLowerCase().includes('explain') || currentInput.toLowerCase().includes('insight')) {
        task = 'insights';
      } else if (currentInput.toLowerCase().includes('safety') || currentInput.toLowerCase().includes('harm')) {
        task = 'safety';
      } else if (currentInput.toLowerCase().includes('web') || currentInput.toLowerCase().includes('search') || currentInput.toLowerCase().includes('current')) {
        task = 'web-analysis';
      } else if (currentInput.toLowerCase().includes('misinformation') || currentInput.toLowerCase().includes('disinformation')) {
        task = 'misinformation';
      } else {
        task = 'fact-check';
      }

      let result;
      let sourceResult: any;

      if (task === 'url-analysis' && contentType === 'url') {
        const [safeSearchResult, verifySourceResult] = await Promise.all([
          safeSearchUrl(currentInput),
          verifySource(currentInput, 'url')
        ]);
        result = { safeSearch: safeSearchResult, verifySource: verifySourceResult };
      } else if (task === 'deepfake' && currentFile) {
        if (currentInput.match(/^https?:\/\//)) {
          sourceResult = await verifySource(currentInput, 'url').catch(e => console.error('Source verification failed:', e));
        }
        result = await detectDeepfake(currentFile.dataUrl, contentType as 'image' | 'video', sourceResult?.sourceCredibility);
      } else if (task === 'insights') {
        result = await provideEducationalInsights(currentInput);
      } else if (task === 'safety') {
        result = await assessSafety(currentInput, contentType as 'text' | 'url' | 'image');
      } else if (task === 'web-analysis') {
        result = await performWebAnalysis(currentInput, contentType as 'text' | 'url');
      } else if (task === 'synthetic-content' && currentFile) {
        result = await detectSyntheticContent(currentFile.dataUrl, contentType as 'image' | 'video');
      } else {
        result = await factCheckClaim(currentInput);
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
