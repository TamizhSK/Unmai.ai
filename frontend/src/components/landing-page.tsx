'use client';

import { useState, useEffect } from 'react';
import { MessagesContainer } from '@/components/messages';
import { InputBar } from '@/components/input-bar';
import { useAnalysis } from '@/hooks/use-analysis';
import { useAuth } from '@/context/auth-context';
import { LightRays } from '@/components/ui/light-rays';
import { TypingAnimation } from '@/components/ui/typing-animation';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { HistorySidebar } from '@/components/history-sidebar';
import { AuthDialog } from '@/components/auth-dialog';
import { User } from 'lucide-react';


export function LandingPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const { isLoading, analysisStage, performAnalysis } = useAnalysis();
  const { isAuthenticated } = useAuth();

  const addMessage = (message: any) => setMessages(prev => [...prev, message]);
  const removeLastMessage = () => setMessages(prev => prev.slice(0, -1));

  const handleNewChat = () => {
    setMessages([]);
    setShowChat(false);
  };

  // Track theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Sample questions that cycle through
  const sampleQuestions = [
    "Analyze this claim about climate change...",
    "Is this news article credible?",
    "Check if this video is a deepfake.",
    "Verify this health information",
    "Analyze the authenticity of this audio",
    "Is this social media post true?"
  ];

  return (
    <SidebarProvider defaultOpen={false}>
      <HistorySidebar onNewChat={handleNewChat} />
      <SidebarInset>
        <div className="flex flex-col h-[100svh] w-full overflow-hidden">
          {!showChat ? (
            // Landing page with LightRays background and centered input
            <div className="relative flex-1 flex flex-col overflow-hidden">
              {/* Top bar on landing page */}
              <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3">
                <SidebarTrigger className="h-8 w-8" />
                {!isAuthenticated && (
                  <Button variant="ghost" size="sm" onClick={() => setAuthDialogOpen(true)} className="gap-2">
                    <User className="h-4 w-4" />
                    Sign In
                  </Button>
                )}
              </div>

              <LightRays
                className="fixed inset-0 w-screen h-[100svh] z-0 will-change-transform"
                style={{ transform: 'translateZ(0)' }}
                color={isDark ? "rgba(6, 182, 212, 0.3)" : "rgba(249, 115, 22, 0.2)"}
                blur={24}
                speed={12}
                count={5}
              />

              <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-5xl mx-auto space-y-8">
                  {/* Heading */}
                  <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8">
                    <span
                      className="bg-clip-text text-transparent"
                      style={{
                        backgroundImage: 'linear-gradient(to left, #4285F4 0%, #DB4437 33%, #F4B400 66%, #0F9D58 100%)'
                      }}
                    >
                      unmai.ai
                    </span>
                  </h1>

                  {/* Subtitle */}
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl max-w-4xl mx-auto leading-relaxed font-medium px-4 text-muted-foreground">
                    Verify credibility and uncover truth with AI-powered analysis
                  </p>

                  {/* Sample Questions */}
                  <div className="mb-8 sm:mb-10">
                    <p className="text-sm sm:text-base text-muted-foreground/70 mb-3 sm:mb-4 font-medium">Try asking:</p>
                    <div className="h-16 sm:h-20 flex items-center justify-center px-4">
                      <TypingAnimation
                        words={sampleQuestions}
                        className="text-foreground font-medium text-base sm:text-lg lg:text-xl text-center max-w-4xl !leading-normal"
                        typeSpeed={50}
                        deleteSpeed={30}
                        pauseDelay={2000}
                        loop
                        showCursor={false}
                        startOnView={false}
                      />
                    </div>
                  </div>

                  {/* Centered InputBar */}
                  <div className="w-full max-w-3xl mx-auto pt-4">
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
            </div>
          ) : (
            // Chat interface - fixed layout with scrollable messages only
            <div className="flex flex-col h-full overflow-hidden">
              {/* Chat header with sidebar trigger + brand */}
              <div className="flex-shrink-0 flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm">
                <SidebarTrigger className="h-8 w-8" />
                <h1 className="font-bold text-lg bg-clip-text text-transparent flex-1" style={{ backgroundImage: 'linear-gradient(to left, #4285F4 0%, #DB4437 33%, #F4B400 66%, #0F9D58 100%)' }}>
                  unmai.ai
                </h1>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewChat}
                  className="text-xs sm:text-sm rounded-full"
                >
                  New Chat
                </Button>
              </div>
              <MessagesContainer
                messages={messages}
                isLoading={isLoading}
                performAnalysis={performAnalysis}
                addMessage={addMessage}
                removeLastMessage={removeLastMessage}
                analysisStage={analysisStage}
              />
              {/* Bottom InputBar - Fixed */}
              <div className="flex-shrink-0 pb-[env(safe-area-inset-bottom)] bg-background">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
          )}
        </div>
      </SidebarInset>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </SidebarProvider>
  );
}
