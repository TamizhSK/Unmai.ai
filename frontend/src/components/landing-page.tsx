'use client';

import { useState, useEffect } from 'react';
import { MessagesContainer } from '@/components/messages';
import { InputBar } from '@/components/input-bar';
import { useAnalysis } from '@/hooks/use-analysis';
import { AuroraText } from '@/components/ui/aurora-text';
import { DotPattern } from '@/components/ui/dot-pattern';
import { TypingAnimation } from '@/components/ui/typing-animation';
import { cn } from '@/lib/utils';

export function LandingPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const { isLoading, performAnalysis } = useAnalysis();

  const addMessage = (message: any) => setMessages(prev => [...prev, message]);
  const removeLastMessage = () => setMessages(prev => prev.slice(0, -1));

  // Sample questions that cycle through
  const sampleQuestions = [
    "Analyze this claim about climate change...",
    "Is this news article credible?",
    "Check if this video is a deepfake.",
    "Verify this health information",
    "Analyze the authenticity of this audio",
    "Is this social media post true?"
  ];

  useEffect(() => {
    if (!showChat) {
      const interval = setInterval(() => {
        setCurrentTextIndex((prev) => (prev + 1) % sampleQuestions.length);
      }, 4000); // Change text every 4 seconds
      
      return () => clearInterval(interval);
    }
  }, [showChat, sampleQuestions.length]);

  return (
    <div className="flex flex-col h-screen w-full max-w-6xl mx-auto overflow-hidden">
      {!showChat ? (
        // Redesigned Landing page with MagicUI components
        <div className="relative flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Dot Pattern Background */}
          <DotPattern 
            className={cn(
              "[mask-image:radial-gradient(400px_circle_at_center,white,transparent)] sm:[mask-image:radial-gradient(600px_circle_at_center,white,transparent)] absolute inset-0 opacity-30 dark:opacity-15"
            )}
            width={16}
            height={16}
            cr={0.8}
          />
          
          <div className="relative z-10 text-center max-w-5xl mx-auto">
            {/* Aurora Text Heading */}
            <div className="mb-6 sm:mb-8">
              <AuroraText 
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight mb-2 sm:mb-4"
                colors={["#4285F4", "#0F9D58", "#F4B400", "#DB4437"]}
              >
                unmai.ai
              </AuroraText>
            </div>
            
           
            {/* Subtitle */}
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 sm:mb-12 max-w-4xl mx-auto leading-relaxed font-medium px-4 
              bg-gradient-to-b from-gray-300 via-gray-400 to-gray-600 bg-clip-text text-transparent">
              Verify credibility and uncover truth with AI-powered analysis
            </p>
            
            {/* Typing Animation for Sample Questions */}
            <div className="mb-16 sm:mb-20">
              <p className="text-xs sm:text-sm text-muted-foreground/70 mb-2 sm:mb-3 font-medium">Try asking:</p>
              <div className="text-sm sm:text-base lg:text-lg text-muted-foreground/80 font-medium min-h-[1.25rem] sm:min-h-[1.5rem] px-4">
                <TypingAnimation
                  key={currentTextIndex} // Force re-render when text changes
                  className="text-[#F4B400] font-semibold text-sm sm:text-base lg:text-2xl"
                  duration={80}
                >
                  {sampleQuestions[currentTextIndex]}
                </TypingAnimation>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Chat interface with scroll wrapper
        <MessagesContainer 
          messages={messages} 
          isLoading={isLoading} 
          performAnalysis={performAnalysis}
          addMessage={addMessage}
          removeLastMessage={removeLastMessage}
        />
      )}
      
      <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          <InputBar
            addMessage={addMessage}
            removeLastMessage={removeLastMessage}
            setShowChat={setShowChat}
            showChat={showChat}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}