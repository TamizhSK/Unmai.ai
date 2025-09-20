'use client';

import { useState } from 'react';
import { MessagesContainer } from '@/components/messages';
import { InputBar } from '@/components/input-bar';
import { useAnalysis } from '@/hooks/use-analysis';

export function LandingPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const { isLoading, performAnalysis } = useAnalysis();

  const addMessage = (message: any) => setMessages(prev => [...prev, message]);
  const removeLastMessage = () => setMessages(prev => prev.slice(0, -1));

  return (
    <div className="flex flex-col h-screen w-full max-w-4xl mx-auto overflow-hidden">
      {!showChat ? (
        // Landing page without scroll wrapper
        <div className="flex-1 flex flex-col justify-center px-4 py-8 overflow-y-auto">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              Verity <span className="text-[#4285F4]">AI</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Verify the credibility of information, detect deepfakes, and uncover the truth behind the content.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-card border rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:border-[#4285F4]/50">
                <div className="text-2xl mb-4">📰</div>
                <h3 className="font-semibold text-lg mb-2">Fact Check Claims</h3>
                <p className="text-muted-foreground text-sm">
                  "Is it true that eating carrots improves your vision significantly?"
                </p>
              </div>
              <div className="bg-card border rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:border-[#0F9D58]/50">
                <div className="text-2xl mb-4">🕵️</div>
                <h3 className="font-semibold text-lg mb-2">Detect Deepfakes</h3>
                <p className="text-muted-foreground text-sm">
                  Upload an image, video or audio to check if it's AI-generated or manipulated.
                </p>
              </div>
              <div className="bg-card border rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:border-[#F4B400]/50">
                <div className="text-2xl mb-4">🌐</div>
                <h3 className="font-semibold text-lg mb-2">Analyze Sources</h3>
                <p className="text-muted-foreground text-sm">
                  Paste a URL to verify the credibility of the source and content.
                </p>
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
      
      <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 py-4">
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