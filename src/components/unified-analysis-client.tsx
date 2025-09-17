'use client';

import { useState } from 'react';
import { getCredibilityScore, GetCredibilityScoreOutput } from '@/ai/flows/get-credibility-score';
import { detectDeepfake, DetectDeepfakeOutput } from '@/ai/flows/detect-deepfake';
import { provideEducationalInsights, ProvideEducationalInsightsOutput } from '@/ai/flows/provide-educational-insights';
import { useToast } from '@/hooks/use-toast';
import { GeminiLoader } from '@/components/gemini-loader';
import { Message, UserMessage } from '@/components/messages';
import { AnalysisResults } from '@/components/analysis-results';
import { DeepfakeResults } from '@/components/deepfake-results';
import { EducationalInsightsResults } from './educational-insights-results';
import { InputBar } from './input-bar';


export type AnalysisTask = 'credibility' | 'deepfake' | 'insights';

export function UnifiedAnalysisClient() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleNewMessage = async (input: string, file: {dataUrl: string, type: string} | null) => {
    
    // Determine content type
    let contentType: 'text' | 'url' | 'image' | 'video' | 'audio' = 'text';
    if (file) {
      if (file.type.startsWith('image/')) contentType = 'image';
      else if (file.type.startsWith('video/')) contentType = 'video';
      else if (file.type.startsWith('audio/')) contentType = 'audio';
    } else if (input.match(/^https?:\/\//)) {
      contentType = 'url';
    }

    // Determine analysis task
    let task: AnalysisTask = 'credibility';
    if (contentType === 'image' || contentType === 'video' || contentType === 'audio') {
        task = 'deepfake';
    } else if (input.toLowerCase().includes('explain') || input.toLowerCase().includes('insight')) {
        task = 'insights';
    }


    const userMessage = {
        type: 'user',
        input,
        file,
        contentType
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      let result;
      if (task === 'credibility') {
        result = await getCredibilityScore({ content: input, contentType: contentType as 'text' | 'url' });
      } else if (task === 'deepfake' && file) {
        result = await detectDeepfake({ media: file.dataUrl, contentType: contentType as 'image' | 'video' | 'audio' });
      } else if (task === 'insights') {
        result = await provideEducationalInsights({ text: input });
      } else {
        throw new Error("Could not determine an appropriate analysis for the given input.");
      }
      
      const aiMessage = {
        type: 'ai',
        task,
        result
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (e: any) {
      let description = "An error occurred during analysis. Please check your input or try again later.";
      if (e.message) {
        if (e.message.includes('503 Service Unavailable') || e.message.includes('overloaded')) {
          description = "The analysis service is currently experiencing high demand. Please try again in a few moments.";
        } else if (e.message.includes('429 Too Many Requests') || e.message.includes('quota')) {
          description = "You've exceeded the request limit for the free tier. Please wait a bit before trying again.";
        }
      }

      toast({
        title: "Analysis Failed",
        description: description,
        variant: "destructive",
      });
      // Remove the user message if the analysis fails
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-12 flex flex-col h-full">
      <div className="flex-1 space-y-6 overflow-y-auto pb-4">
            {messages.length === 0 && !isLoading && (
                <div className="text-center flex flex-col justify-center h-full">
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
                        <div className="w-full">
                          {msg.task === 'credibility' && <AnalysisResults result={msg.result} />}
                          {msg.task === 'deepfake' && <DeepfakeResults result={msg.result} />}
                          {msg.task === 'insights' && <EducationalInsightsResults result={msg.result} />}
                        </div>
                    )}
                </Message>
            ))}
            {isLoading && (
                <Message>
                    <GeminiLoader />
                </Message>
            )}
        </div>
        <div className="bg-background/80 py-4 backdrop-blur-md">
            <InputBar onSubmit={handleNewMessage} disabled={isLoading} />
        </div>
    </div>
  );
}
