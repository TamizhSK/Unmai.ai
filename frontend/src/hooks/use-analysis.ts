'use client';

import { useState, useRef, useCallback } from 'react';
import {
  analyzeUnified,
  analyzeUnifiedStream,
  translateText,
  translateBatch
} from '@/lib/simple-api-client';
import { useToast } from '@/hooks/use-toast';

export type AnalysisTask = 'url-analysis' | 'text-analysis' | 'image-analysis' | 'video-analysis' | 'audio-analysis';

type AiMessage = {
  type: 'ai';
  task: AnalysisTask;
  result: any;
};

export function useAnalysis() {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [expectedChecks, setExpectedChecks] = useState<string[]>([]);
  const { toast } = useToast();
  const activeRequestRef = useRef<string | null>(null);

  const performAnalysis = async (
    input: string,
    file: { dataUrl: string, type: string } | null,
    language: string,
    addMessage: (message: any) => void,
    removeLastMessage: () => void
  ) => {
    // Deduplicate: skip if the same request is already in-flight
    const requestKey = `${input}:${file?.dataUrl?.slice(0, 50) ?? ''}:${language}`;
    if (activeRequestRef.current === requestKey) return;
    activeRequestRef.current = requestKey;

    setIsLoading(true);

    try {
      let currentInput = input;
      const currentFile = file;

      let originalLanguage = language;
      // Only translate non-URL text inputs (translating URLs would mangle them)
      const looksLikeUrl = /^https?:\/\//i.test(currentInput.trim());
      if (language !== 'en-US' && currentInput && typeof currentInput === 'string' && !looksLikeUrl && !currentFile) {
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

      // Build payload for unified analyzer
      const buildPayload = () => {
        if (contentType === 'text') return { text: currentInput };
        if (contentType === 'url') return { url: currentInput };
              if (currentFile && (contentType === 'image' || contentType === 'video' || contentType === 'audio')) {
                const dataKey = contentType === 'image' ? 'imageData' : contentType === 'video' ? 'videoData' : 'audioData';
                const payload: any = { [dataKey]: currentFile.dataUrl, mimeType: currentFile.type };
                if (contentType === 'audio') {
                  payload.language = originalLanguage;
                }
                return payload;
              }        return { text: currentInput };
      };

      // Call streaming endpoint for real-time progress updates.
      // Progress is shown via the skeleton in MessagesContainer (driven by analysisStage/expectedChecks state).
      // We do NOT add loading messages to the messages array — that caused stuck "Analysis could not be completed" bugs.
      let streamError: string | null = null;

      try {
        await analyzeUnifiedStream(
          contentType,
          buildPayload(),
          (stage, _message, _elapsed, checks) => {
            setAnalysisStage(stage);
            if (checks) setExpectedChecks(checks);
          },
          (streamResult) => { result = streamResult; },
          (err) => {
            console.error('[STREAM ERROR]', err);
            streamError = err;
          },
        );
      } catch (streamCatchError: any) {
        console.error('[STREAM CATCH ERROR]', streamCatchError);
        // Streaming failed — fall back to non-streaming endpoint
        try {
          result = await analyzeUnified(contentType, buildPayload());
        } catch (fallbackError: any) {
          console.error('[FALLBACK ERROR]', fallbackError);
          streamError = fallbackError.message || 'Analysis failed';
        }
      }

      // Handle error case — remove user message and show toast
      if (streamError && !result) {
        console.error('[FINAL ERROR]', streamError);
        toast({
          title: "Analysis Failed",
          description: streamError.length > 100 ? "An error occurred during analysis. Please try again." : streamError,
          variant: "destructive",
        });
        removeLastMessage(); // Remove the user message
        return; // Exit early on error
      }

      // Batch translate all translatable fields in a single API call (was N sequential calls)
      const translateUnifiedFields = async (targetLang: string, payload: any) => {
        const unifiedKeys = [
          'oneLineDescription', 'summary', 'informationSummary',
          'educationalInsight', 'inputDescription', 'explanation', 'claim', 'evidence'
        ];

        // Collect all texts to translate in one batch
        const textsToTranslate: string[] = [];
        const keyMap: Array<{ type: 'field'; key: string } | { type: 'source'; index: number }> = [];

        for (const key of unifiedKeys) {
          if (payload && typeof payload[key] === 'string' && payload[key].trim()) {
            textsToTranslate.push(payload[key]);
            keyMap.push({ type: 'field', key });
          }
        }
        if (Array.isArray(payload?.sources)) {
          payload.sources.forEach((source: any, i: number) => {
            if (source && typeof source.title === 'string' && source.title.trim()) {
              textsToTranslate.push(source.title);
              keyMap.push({ type: 'source', index: i });
            }
          });
        }

        if (textsToTranslate.length === 0) return;

        try {
          const translated = await translateBatch(textsToTranslate, targetLang);
          translated.forEach((t, idx) => {
            const mapping = keyMap[idx];
            if (mapping.type === 'field') payload[mapping.key] = t;
            else if (mapping.type === 'source') payload.sources[mapping.index].title = t;
          });
        } catch (err) {
          console.error('Batch translation failed, falling back to originals:', err);
        }
      };

      if (originalLanguage !== 'en-US' && result) {
        await translateUnifiedFields(originalLanguage, result);
      }

      const aiMessage: AiMessage = { type: 'ai', task, result };
      addMessage(aiMessage);

    } catch (e: any) {
      console.error('[OUTER CATCH ERROR]', e);
      let description = "An error occurred during analysis. Please check your input or try again later.";
      if (e.message?.includes('503') || e.message?.includes('overloaded')) {
        description = "The analysis service is currently experiencing high demand. Please try again in a few moments.";
      } else if (e.message?.includes('429') || e.message?.includes('quota')) {
        description = "You've exceeded the request limit. Please wait a bit before trying again.";
      }
      toast({ title: "Analysis Failed", description, variant: "destructive" });
      removeLastMessage();
    } finally {
      activeRequestRef.current = null;
      setIsLoading(false);
      setAnalysisStage('');
      setExpectedChecks([]);
    }
  };

  return { isLoading, analysisStage, expectedChecks, performAnalysis };
}
