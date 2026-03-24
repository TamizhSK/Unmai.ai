'use client';

import { useState, useEffect } from 'react';
import { MessagesContainer } from '@/components/messages';
import { InputBar } from '@/components/input-bar';
import { useAnalysis } from '@/hooks/use-analysis';
import { useAuth } from '@/context/auth-context';
import { LightRays } from '@/components/ui/light-rays';
import { WordRotate } from '@/components/ui/word-rotate';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { HistorySidebar } from '@/components/history-sidebar';
import { AuthDialog } from '@/components/auth-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, LogOut } from 'lucide-react';
import Image from 'next/image';


export function LandingPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const { isLoading, analysisStage, expectedChecks, performAnalysis } = useAnalysis();
  const { isAuthenticated, user, logout } = useAuth();

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

  // Sample questions for morphing text
  const sampleQuestions = [
    "Is this news credible?",
    "Check this deepfake",
    "Verify this claim",
    "Analyze this audio",
    "Is this post true?",
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
              <div className="relative z-20 flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3">
                <SidebarTrigger className="h-8 w-8" />
                <div className="flex items-center gap-2">
                  {isAuthenticated && user ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-7 w-7 cursor-default">
                        <AvatarFallback className="text-xs bg-primary/10 font-semibold">
                          {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        onClick={logout}
                        title="Sign out"
                        aria-label="Sign out"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setAuthDialogOpen(true)} className="gap-1.5 text-xs sm:text-sm rounded-full">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">Sign In</span>
                    </Button>
                  )}
                </div>
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
                <div className="text-center w-full max-w-3xl mx-auto space-y-3 sm:space-y-5 md:space-y-6">
                  {/* Heading */}
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
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
                  <p className="text-sm sm:text-base md:text-lg max-w-xl mx-auto leading-relaxed font-medium px-2 text-muted-foreground">
                    Verify credibility and uncover truth with AI-powered analysis
                  </p>

                  {/* Rotating sample questions */}
                  <div>
                    <p className="text-xs text-muted-foreground/60 mb-1 font-medium">Try asking:</p>
                    <WordRotate
                      words={sampleQuestions}
                      duration={3000}
                      className="text-sm sm:text-base md:text-lg font-semibold text-foreground"
                    />
                  </div>

                  {/* Centered InputBar */}
                  <div className="w-full max-w-3xl mx-auto px-1">
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
            <div className="relative flex flex-col h-full overflow-hidden">
              <LightRays
                className="fixed inset-0 w-screen h-[100svh] z-0 will-change-transform"
                style={{ transform: 'translateZ(0)' }}
                color={isDark ? "rgba(6, 182, 212, 0.15)" : "rgba(249, 115, 22, 0.1)"}
                blur={24}
                speed={12}
                count={3}
              />

              {/* Chat header with sidebar trigger + brand */}
              <div className="relative z-10 flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 md:px-6 py-2 sm:py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm">
                <SidebarTrigger className="h-8 w-8" />
                <h1 className="font-bold text-xl bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to left, #4285F4 0%, #DB4437 33%, #F4B400 66%, #0F9D58 100%)' }}>
                  unmai.ai
                </h1>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewChat}
                  className="text-xs sm:text-sm rounded-full"
                >
                  New Chat
                </Button>
                {isAuthenticated && user ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-7 w-7 cursor-default">
                      <AvatarFallback className="text-xs bg-primary/10 font-semibold">
                        {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      onClick={logout}
                      title="Sign out"
                      aria-label="Sign out"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setAuthDialogOpen(true)} className="gap-1.5 text-xs rounded-full">
                    <User className="h-3.5 w-3.5" />
                    Sign In
                  </Button>
                )}
              </div>
              <MessagesContainer
                messages={messages}
                isLoading={isLoading}
                performAnalysis={performAnalysis}
                addMessage={addMessage}
                removeLastMessage={removeLastMessage}
                analysisStage={analysisStage}
                expectedChecks={expectedChecks}
              />
              {/* Bottom InputBar - Fixed */}
              <div className="flex-shrink-0 pb-[env(safe-area-inset-bottom)] bg-background">
                <div className="max-w-3xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-4">
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
