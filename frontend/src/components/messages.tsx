'use client';

import { ReactNode, useRef, useEffect } from 'react';
import { User, BotMessageSquare, FileVideo, FileAudio } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { DynamicAnalysisResult } from './dynamic-analysis-result';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Message({ children, isUser = false }: { children: ReactNode; isUser?: boolean }) {
  return (
    <div className={`flex items-start gap-2 sm:gap-2 ${isUser ? 'justify-end' : ''} w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
      {!isUser && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-[#4285F4] text-white">
            <BotMessageSquare className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      {isUser ? (
        <Card className={cn(
          "w-auto max-w-[85%] sm:max-w-[70%] md:max-w-[60%] lg:max-w-lg rounded-lg shadow-sm border transition-all duration-300",
          "bg-primary text-primary-foreground border-primary/20"
        )}>
          <div className="px-0.5 py-0.5">
            {children}
          </div>
        </Card>
      ) : (
        <div className="w-auto max-w-[85%] sm:max-w-[70%] md:max-w-[60%] lg:max-w-lg">
          {children}
        </div>
      )}
      {isUser && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function UserMessage({ content, file }: { content: string; file: {dataUrl: string, type: string} | null }) {
  // For pure text messages, render just the paragraph to avoid extra wrapper spacing
  if (!file) {
    return content ? <p className="text-base break-words whitespace-pre-wrap">{content}</p> : null;
  }

  // For messages with a file, render preview plus text with proper spacing
  return (
    <div className="space-y-3">
      <div className="relative h-20 w-20 rounded-lg overflow-hidden border bg-muted">
        {file.type.startsWith('image/') ? (
          <Image src={file.dataUrl} alt="uploaded content" fill className="object-cover" />
        ) : file.type.startsWith('video/') ? (
          <div className="flex flex-col gap-1 items-center justify-center h-full text-muted-foreground text-xs p-2">
            <FileVideo className="h-6 w-6" />
            <span>Video</span>
          </div>
        ) : file.type.startsWith('audio/') ? (
          <div className="flex flex-col gap-1 items-center justify-center h-full text-muted-foreground text-xs p-2">
            <FileAudio className="h-6 w-6" />
            <span>Audio</span>
          </div>
        ) : null}
      </div>
      {content && <p className="text-base break-words whitespace-pre-wrap">{content}</p>}
    </div>
  );
}

function AnalysisLoadingSkeleton() {
  return (
    <Message isUser={false}>
      <div className="text-card-foreground w-auto max-w-[85%] sm:max-w-[70%] md:max-w-[60%] lg:max-w-lg rounded-lg shadow-sm border transition-all duration-300 bg-card border-border/15">
        <div className="p-4 space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    </Message>
  );
}

export function MessagesContainer({ 
  messages, 
  isLoading = false,
  performAnalysis,
  addMessage,
  removeLastMessage,
}: { 
  messages: any[]; 
  isLoading?: boolean;
  performAnalysis: (
    input: string,
    file: { dataUrl: string, type: string } | null,
    language: string,
    addMessage: (message: any) => void,
    removeLastMessage: () => void
  ) => Promise<void>;
  addMessage: (message: any) => void;
  removeLastMessage: () => void;
}) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track the last index for which analysis has been triggered to avoid duplicates
  const lastAnalyzedIndexRef = useRef<number>(-1);

  // Smooth scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    });
  };

  // Determine if user is near the bottom of the viewport
  const isNearBottom = () => {
    const root = scrollAreaRef.current;
    if (!root) return true;
    const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return true;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    return distanceFromBottom < 100; // px threshold
  };

  useEffect(() => {
    // If the latest message is a user message and hasn't been analyzed yet, trigger analysis
    const lastIndex = messages.length - 1;
    if (lastIndex >= 0 && lastIndex !== lastAnalyzedIndexRef.current) {
      const last = messages[lastIndex];
      if (last?.type === 'user') {
        lastAnalyzedIndexRef.current = lastIndex;
        const input = last?.input ?? '';
        const file = last?.file ? { dataUrl: last.file.dataUrl, type: last.file.type } : null;
        const language = last?.language ?? 'en-US';
        performAnalysis(input, file, language, addMessage, removeLastMessage).catch(() => {});
        // Ensure we scroll to show the skeleton immediately
        scrollToBottom();
      }
    }

    // While loading or when messages update near bottom, keep view pinned
    if (isNearBottom()) {
      scrollToBottom();
    }
  }, [messages, isLoading, performAnalysis, addMessage, removeLastMessage]);

  return (
    <div className="flex-1 relative overflow-hidden">
      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="mx-auto max-w-4xl space-y-3 pb-4 px-2 sm:px-3 pt-16">
          {messages.map((msg, index) => (
            <Message key={index} isUser={msg.type === 'user'}>
              {msg.type === 'user' ? (
                <UserMessage content={msg.input} file={msg.file} />
              ) : (
                <DynamicAnalysisResult task={msg.task} result={msg.result} sourceResult={msg.sourceResult} />
              )}
            </Message>
          ))}
          {/* Skeleton placeholder for AI response */}
          {(() => {
            const lastIndex = messages.length - 1;
            const latestIsUser = lastIndex >= 0 && messages[lastIndex]?.type === 'user';
            // If a new user message exists whose index is greater than what we've analyzed, show skeleton immediately
            const pendingForLatest = latestIsUser && lastAnalyzedIndexRef.current < lastIndex;
            const showSkeleton = pendingForLatest || isLoading;
            
            // Debug logging to see when skeleton should appear
            // console.log('Skeleton visibility check:', { 
            //   lastIndex, 
            //   latestIsUser, 
            //   lastAnalyzedIndex: lastAnalyzedIndexRef.current,
            //   pendingForLatest, 
            //   isLoading, 
            //   showSkeleton 
            // });
            
            return showSkeleton ? (
              <AnalysisLoadingSkeleton />
            ) : null;
          })()}
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </ScrollArea>
      
      {/* Top blur gradient overlay - positioned above content */}
      <div className="absolute top-0 left-0 right-0 h-14 pointer-events-none z-20 bg-gradient-to-b from-background to-transparent" />
      
      {/* Bottom blur gradient overlay - positioned above content */}  
      <div className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none z-20 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}