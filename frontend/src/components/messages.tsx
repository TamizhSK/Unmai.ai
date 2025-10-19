'use client';

import { ReactNode, useRef, useEffect, useState } from 'react';

// Hook for theme detection
function useTheme() {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  return isDark;
}
import { FileVideo, FileAudio } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { DynamicAnalysisResult } from './dynamic-analysis-result';
import Image from 'next/image';

export function Message({ children, isUser = false, hasMedia = false }: { children: ReactNode; isUser?: boolean; hasMedia?: boolean }) {
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''} w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
      {!isUser && (
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
          <AvatarImage src="/favicon.ico" alt="Unmai" className="object-contain p-0.5" />
          <AvatarFallback className="bg-background border">
            <img src="/favicon.ico" alt="" className="h-full w-full object-contain p-0.5" />
          </AvatarFallback>
        </Avatar>
      )}
      {isUser ? (
        <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-xl">
          {children}
        </div>
      ) : (
        <div className="relative max-w-[90%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-xl">
          <div className="relative bg-card rounded-2xl p-3 sm:p-4 shadow-lg border border-border/50 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-300">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export function UserMessage({ content, file }: { content: string; file: {dataUrl: string, type: string, name?: string} | null }) {
  // State for non-playable video thumbnail
  const [videoThumb, setVideoThumb] = useState<string | null>(null);

  const isImage = !!file && file.type.startsWith('image/');
  const isVideo = !!file && file.type.startsWith('video/');
  const isAudio = !!file && file.type.startsWith('audio/');
  const hasText = !!content;

  // Generate first-frame thumbnail for videos (non-playable preview)
  useEffect(() => {
    if (!file || !isVideo) {
      setVideoThumb(null);
      return;
    }
    let cancelled = false;
    const video = document.createElement('video');
    video.src = file.dataUrl;
    video.muted = true;
    (video as any).playsInline = true;

    const handleSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 200;
        canvas.height = video.videoHeight || 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const url = canvas.toDataURL('image/png');
          if (!cancelled) setVideoThumb(url);
        }
      } catch {}
    };

    const handleLoadedMeta = () => {
      // Seek to a small offset to ensure frame availability
      try {
        video.currentTime = 0.1;
      } catch {
        handleSeeked();
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMeta);
    video.addEventListener('seeked', handleSeeked);

    // Kick off load
    try { video.load(); } catch {}

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleLoadedMeta);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [file, isVideo]);

  // For pure text messages
  if (!file) {
    return content ? (
      <div className="px-3 py-2 sm:px-4 sm:py-3 bg-primary text-primary-foreground rounded-2xl">
        <p className="text-base break-words whitespace-pre-wrap m-0">{content}</p>
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-2">
      {isImage && (
        <div className="relative max-w-[160px] sm:max-w-[200px] md:max-w-[240px] rounded-2xl overflow-hidden">
          <Image
            src={file.dataUrl}
            alt="uploaded content"
            width={240}
            height={240}
            className="object-contain w-full h-auto"
            style={{ maxHeight: '240px' }}
          />
        </div>
      )}

      {isVideo && (
        <div className="relative max-w-[160px] sm:max-w-[200px] md:max-w-[240px] rounded-2xl overflow-hidden bg-muted/40" style={{ minHeight: '120px' }}>
          {videoThumb ? (
            <Image
              src={videoThumb}
              alt={file.name || 'video'}
              width={240}
              height={240}
              className="object-cover w-full h-auto"
              style={{ maxHeight: '240px' }}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full p-6 text-muted-foreground">
              <FileVideo className="h-6 w-6" />
            </div>
          )}
          {/* Filename overlay (non-interactive) */}
          <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] px-2 py-1 truncate">
            {file.name || 'video'}
          </div>
        </div>
      )}

      {isAudio && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-xl max-w-[160px] sm:max-w-[200px]">
          <FileAudio className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-xs text-foreground truncate">{file.name || 'audio'}</span>
        </div>
      )}

      {hasText && (
        <div className="px-3 py-2 sm:px-4 sm:py-3 bg-primary text-primary-foreground rounded-2xl">
          <p className="text-base break-words whitespace-pre-wrap">{content}</p>
        </div>
      )}
    </div>
  );
}

function AnalysisLoadingSkeleton() {
  return (
    <div className={`flex items-start gap-3 w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
      <Avatar className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
        <AvatarImage src="/favicon.ico" alt="Unmai" className="object-contain p-0.5" />
        <AvatarFallback className="bg-background border">
          <img src="/favicon.ico" alt="" className="h-full w-full object-contain p-0.5" />
        </AvatarFallback>
      </Avatar>
      <div className="relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-xl">
        <div className="relative bg-card rounded-2xl p-3 sm:p-4 shadow-md border border-border/50 space-y-3">
          <Skeleton className="h-4 w-[280px]" />
          <Skeleton className="h-4 w-[280px]" />
          <Skeleton className="h-4 w-[240px]" />
          <Skeleton className="h-4 w-[240px]" />
          <div className="pt-2">
            <Skeleton className="h-4 w-[100px]" />
          </div>
        </div>
      </div>
    </div>
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
  const lastAnalyzedIndexRef = useRef<number>(-1);
  const isDark = useTheme();

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
        <div className="mx-auto max-w-5xl space-y-4 pb-6 px-3 sm:px-6 pt-16 sm:pt-20">
          {messages.map((msg, index) => (
            <Message 
              key={index} 
              isUser={msg.type === 'user'}
              hasMedia={msg.type === 'user' && msg.file && (msg.file.type.startsWith('image/') || msg.file.type.startsWith('video/'))}
            >
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
            const pendingForLatest = latestIsUser && lastAnalyzedIndexRef.current < lastIndex;
            const showSkeleton = pendingForLatest || isLoading;
            
            return showSkeleton ? (
              <AnalysisLoadingSkeleton />
            ) : null;
          })()}
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </ScrollArea>
      
      {/* Top fade gradient overlay - positioned above content */}
      <div className="absolute top-0 left-0 right-0 h-12 pointer-events-none z-20 bg-gradient-to-b from-background to-transparent" />
      
      {/* Bottom fade gradient overlay - enhanced for better visibility */}  
      <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none z-20 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}