'use client';

import { useState, useRef, useEffect } from 'react';
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
import { GeminiLoader } from '@/components/gemini-loader';
import { Message, UserMessage } from '@/components/messages';
import { InputBar } from '@/components/input-bar';
import { useToast } from '@/hooks/use-toast';
import { DynamicAnalysisResult } from './dynamic-analysis-result';
import { ScrollArea } from './ui/scroll-area';

export type AnalysisTask = 'credibility' | 'deepfake' | 'insights' | 'safety' | 'verify-source' | 'web-analysis' | 'synthetic-content' | 'misinformation' | 'safe-search' | 'fact-check' | 'url-analysis';

type AiMessage = {
  type: 'ai';
  task: AnalysisTask;
  result: any;
  sourceResult?: any;
};

export function UnifiedAnalysisClient() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to the bottom when new messages are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleNewMessage = async (input: string, file: {dataUrl: string, type: string} | null, language: string) => {
    
    const userMessage = {
        type: 'user',
        input,
        file,
        contentType: file?.type.split('/')[0] || (input.match(/^https?:\/\//) ? 'url' : 'text')
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      let currentInput = input;
      let currentFile = file;
      
      if (currentFile && currentFile.type.startsWith('audio/')) {
        try {
          const base64Data = currentFile.dataUrl.split(',')[1];
          const transcribedText = await transcribeAudioFlow(base64Data);
          currentInput = transcribedText as string;
          currentFile = null;
        } catch (transcriptionError) {
          console.error("Transcription failed:", transcriptionError);
          toast({
            title: "Audio Transcription Failed",
            description: "Could not process the audio. Please try again.",
            variant: "destructive",
          });
          setMessages(prev => prev.slice(0, -1));
          return;
        }
      }

      let originalLanguage = language;
      if (language !== 'en-US' && currentInput) {
        try {
          currentInput = await translateText(currentInput, 'en-US') as string;
        } catch (translationError) {
          console.error("Input translation failed:", translationError);
          toast({
            title: "Translation Failed",
            description: "Could not translate your text. Please try again.",
            variant: "destructive",
          });
          setMessages(prev => prev.slice(0, -1));
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
          if (result[field]) {
            result[field] = await translateText(result[field], originalLanguage);
          }
        }
      }
      
      const aiMessage: AiMessage = { type: 'ai', task, result, sourceResult };
      setMessages(prev => [...prev, aiMessage]);

    } catch (e: any) {
      let description = "An error occurred during analysis. Please check your input or try again later.";
      if (e.message?.includes('503') || e.message?.includes('overloaded')) {
        description = "The analysis service is currently experiencing high demand. Please try again in a few moments.";
      } else if (e.message?.includes('429') || e.message?.includes('quota')) {
        description = "You've exceeded the request limit. Please wait a bit before trying again.";
      }
      toast({ title: "Analysis Failed", description, variant: "destructive" });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
        <div className="space-y-6 pb-4">
          {messages.length === 0 && !isLoading && (
              <div className="text-center flex flex-col justify-center h-full pt-24">
                  <div>
                      <h1 className="font-headline text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-primary">
                          Verity AI
                      </h1>
                      <p className="mx-auto mt-4 max-w-[700px] text-muted-foreground md:text-xl">
                          How can I help you analyze content today?
                      </p>
                  </div>
              </div>
          )}
          {messages.map((msg, index) => (
              <Message key={index} isUser={msg.type === 'user'}>
                  {msg.type === 'user' ? (
                      <UserMessage content={msg.input} file={msg.file} />
                  ) : (
                      <DynamicAnalysisResult task={msg.task} result={msg.result} sourceResult={msg.sourceResult} />
                  )}
              </Message>
          ))}
          {isLoading && (
              <Message>
                  <GeminiLoader />
              </Message>
          )}
        </div>
      </ScrollArea>
      <div className="mt-auto pt-4 bg-background/80 backdrop-blur-md">
          <InputBar 
            onSubmit={handleNewMessage} 
            disabled={isLoading}
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
          />
      </div>
    </div>
  );
}
