'use client';

import { useState } from 'react';
import { getCredibilityScore, GetCredibilityScoreOutput } from '@/ai/flows/get-credibility-score';
import { detectDeepfake, DetectDeepfakeOutput } from '@/ai/flows/detect-deepfake';
import { provideEducationalInsights, ProvideEducationalInsightsOutput } from '@/ai/flows/provide-educational-insights';
import { assessSafety } from '@/ai/flows/safety-assessment';
import { verifySource, VerifySourceOutput } from '@/ai/flows/verify-source';
import { performWebAnalysis } from '@/ai/flows/perform-web-analysis';
import { detectSyntheticContent } from '@/ai/flows/detect-synthetic-content';
import { analyzeContentForMisinformation } from '@/ai/flows/analyze-content-for-misinformation';
import { safeSearchUrl } from '@/ai/flows/safe-search-url';
import { factCheckClaim } from '@/ai/flows/fact-check-claim';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { GeminiLoader } from '@/components/gemini-loader';
import { Message, UserMessage } from '@/components/messages';
import { AnalysisResults } from '@/components/analysis-results';
import { EducationalInsightsResults } from '@/components/educational-insights-results';
import { SafetyAssessmentResults } from '@/components/safety-assessment-results';
import { VerifySourceResults } from '@/components/verify-source-results';
import { PerformWebAnalysisResults } from '@/components/perform-web-analysis-results';
import { DetectSyntheticContentResults } from '@/components/detect-synthetic-content-results';
import { AnalyzeContentResults } from '@/components/analyze-content-results';
import { UnifiedDeepfakeAnalysis } from '@/components/unified-deepfake-analysis';
import { InputBar } from '@/components/input-bar';
import { SafeSearchResults } from './safe-search-results';
import { FactCheckClaimResults } from './fact-check-claim-results';
import { UrlAnalysisResults } from './url-analysis-results';


export type AnalysisTask = 'credibility' | 'deepfake' | 'insights' | 'safety' | 'verify-source' | 'web-analysis' | 'synthetic-content' | 'misinformation' | 'safe-search' | 'fact-check' | 'url-analysis';

type AiMessage = {
  type: 'ai';
  task: AnalysisTask;
  result: any;
  sourceResult?: VerifySourceOutput;
};

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
    let task: AnalysisTask;
    if (contentType === 'url') {
      task = 'url-analysis';
    } else if (contentType === 'image' || contentType === 'video' || contentType === 'audio') {
        if (input.toLowerCase().includes('synthetic') || input.toLowerCase().includes('ai-generated')) {
            task = 'synthetic-content';
        } else {
            task = 'deepfake';
        }
    } else if (input.toLowerCase().includes('explain') || input.toLowerCase().includes('insight')) {
        task = 'insights';
    } else if (input.toLowerCase().includes('safety') || input.toLowerCase().includes('harm')) {
        task = 'safety';
    } else if (input.toLowerCase().includes('web') || input.toLowerCase().includes('search') || input.toLowerCase().includes('current')) {
        task = 'web-analysis';
    } else if (input.toLowerCase().includes('misinformation') || input.toLowerCase().includes('disinformation')) {
        task = 'misinformation';
    } else {
        // Default to fact-checking for text
        task = 'fact-check';
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
      let sourceResult: VerifySourceOutput | undefined;

      // Always verify the source first
      try {
        let verifyContentType: 'text' | 'url' | 'media' = 'text';
        if (contentType === 'url') {
          verifyContentType = 'url';
        } else if (contentType === 'image' || contentType === 'video' || contentType === 'audio') {
          verifyContentType = 'media';
        }
        sourceResult = await verifySource({ content: input || file!.dataUrl, contentType: verifyContentType });
      } catch (sourceError) {
        console.error('Source verification failed:', sourceError);
      }
      
      if (task === 'url-analysis' && contentType === 'url') {
        const [safeSearchResult, webAnalysisResult] = await Promise.all([
          safeSearchUrl({ url: input }),
          performWebAnalysis({ query: input, contentType: 'url' })
        ]);
        result = {
          safeSearch: safeSearchResult,
          webAnalysis: webAnalysisResult
        };
      } else if (task === 'deepfake' && file) {
        result = await detectDeepfake({ media: file.dataUrl, contentType: contentType as 'image' | 'video' | 'audio' }, sourceResult?.sourceCredibility);
      } else if (task === 'insights') {
        result = await provideEducationalInsights({ text: input });
      } else if (task === 'safety') {
        result = await assessSafety({ content: input, contentType: contentType as 'text' | 'url' | 'image' });
      } else if (task === 'web-analysis') {
        result = await performWebAnalysis({ query: input, contentType: contentType as 'text' | 'url' });
      } else if (task === 'synthetic-content' && file) {
        result = await detectSyntheticContent({ media: file.dataUrl, contentType: contentType as 'image' | 'video' | 'audio' });
      } else if (task === 'misinformation') {
        result = await analyzeContentForMisinformation({ content: input });
      } else if (task === 'fact-check' && contentType === 'text') {
        result = await factCheckClaim({ claim: input });
      } else {
        // Fallback for any unhandled cases, like text that slips through
        result = await factCheckClaim({ claim: input });
      }
      
      const aiMessage: AiMessage = {
        type: 'ai',
        task,
        result,
        sourceResult
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
                          {msg.task === 'credibility' && <AnalysisResults result={msg.result} sourceResult={msg.sourceResult} />}
                          {msg.task === 'deepfake' && <UnifiedDeepfakeAnalysis 
                            deepfakeResult={msg.result} 
                            sourceResult={msg.sourceResult} 
                          />}
                          {msg.task === 'insights' && <EducationalInsightsResults result={msg.result} sourceResult={msg.sourceResult} />}
                          {msg.task === 'safety' && <SafetyAssessmentResults result={msg.result} sourceResult={msg.sourceResult} />}
                          {msg.task === 'verify-source' && <VerifySourceResults result={msg.result} sourceResult={msg.sourceResult} />}
                          {msg.task === 'web-analysis' && <PerformWebAnalysisResults result={msg.result} sourceResult={msg.sourceResult} />}
                          {msg.task === 'synthetic-content' && <DetectSyntheticContentResults result={msg.result} sourceResult={msg.sourceResult} />}
                          {msg.task === 'misinformation' && <AnalyzeContentResults result={msg.result} sourceResult={msg.sourceResult} />}
                          {msg.task === 'safe-search' && <SafeSearchResults result={msg.result} sourceResult={msg.sourceResult} />}
                          {msg.task === 'fact-check' && <FactCheckClaimResults result={msg.result} sourceResult={msg.sourceResult} />}
                          {msg.task === 'url-analysis' && <UrlAnalysisResults result={msg.result} sourceResult={msg.sourceResult} />}
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
