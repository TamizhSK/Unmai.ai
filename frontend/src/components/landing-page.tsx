'use client';

import { useState, useRef, ChangeEvent, FormEvent, DragEvent, ClipboardEvent } from 'react';
import { Mic, Paperclip, Send, X, Square, UploadCloud, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { GeminiLoaderRing } from '@/components/gemini-loader';
import "./gemini-loader.css";
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LandingPage() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<{ dataUrl: string, name: string, type: string } | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile && (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('audio/'))) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFile({
          dataUrl: reader.result as string,
          name: selectedFile.name,
          type: selectedFile.type,
        });
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files?.[0] || null);
  };

  const handleMicClick = () => {
    if (isRecognizing) {
      recognitionRef.current?.stop();
      setIsRecognizing(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = selectedLanguage;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onend = () => setIsRecognizing(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecognizing(false);
    };

    recognition.start();
    setIsRecognizing(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    
    // Simulate loading
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  };

  const handleDragEnter = (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files?.[0] || null);
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    handleFileSelect(e.clipboardData.files?.[0] || null);
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Main content area - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center max-w-3xl mx-auto pt-16"> {/* Added pt-16 to account for fixed header */}
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              Verity <span className="text-primary">AI</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Verify the credibility of information, detect deepfakes, and uncover the truth behind the content.
            </p>
            
            {/* Sample usage cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-card border rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl mb-4">📰</div>
                <h3 className="font-semibold text-lg mb-2">Fact Check Claims</h3>
                <p className="text-muted-foreground text-sm">
                  "Is it true that eating carrots improves your vision significantly?"
                </p>
              </div>
              <div className="bg-card border rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl mb-4">🕵️</div>
                <h3 className="font-semibold text-lg mb-2">Detect Deepfakes</h3>
                <p className="text-muted-foreground text-sm">
                  Upload an image or video to check if it's AI-generated or manipulated.
                </p>
              </div>
              <div className="bg-card border rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl mb-4">🌐</div>
                <h3 className="font-semibold text-lg mb-2">Analyze Sources</h3>
                <p className="text-muted-foreground text-sm">
                  Paste a URL to verify the credibility of the source and content.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Fixed input area */}
      <div className="fixed bottom-16 left-0 right-0 z-20 bg-background">
        <div className="container mx-auto px-4 py-4">
          <form 
            onSubmit={handleSubmit} 
            onDragEnter={handleDragEnter}
            className="relative max-w-3xl mx-auto"
          >
            {isDragging && (
              <div
                className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex flex-col items-center justify-center z-10"
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                role="region"
                aria-label="File drop area"
                aria-describedby="drop-area-description"
              >
                <UploadCloud className="h-12 w-12 text-primary" />
                <p id="drop-area-description" className="text-primary font-medium">Drop your file here</p>
              </div>
            )}
            {file && (
              <div className="relative group w-fit mb-2">
                <div className="relative h-24 w-24 rounded-lg overflow-hidden border">
                  {file.type.startsWith('image/') ? (
                    <Image src={file.dataUrl} alt={file.name} fill objectFit="cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-muted text-muted-foreground text-xs p-2">
                      <span>{file.name}</span>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="relative bg-background border rounded-3xl shadow-lg p-4">
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={isLoading || isRecognizing}
                      className="rounded-full"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      Attach File
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleMicClick}>
                      {isRecognizing ? 'Stop Recognition' : 'Start Recognition'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/*,video/*,audio/*"
                />
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Analyze text, a URL, or paste/drop an image, video, or audio file..."
                  className="min-h-[80px] w-full resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={isLoading || isRecognizing}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-fit">
                    <Languages className="h-5 w-5" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English</SelectItem>
                    <SelectItem value="es-ES">Español</SelectItem>
                    <SelectItem value="fr-FR">Français</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={isLoading || isRecognizing || (!input.trim() && !file)}
                  className={`rounded-full ${isLoading ? '!bg-primary !text-primary-foreground !opacity-100' : ''}`}
                >
                  {isLoading ? (
                    <div className="h-4 w-4">
                      <GeminiLoaderRing />
                    </div>
                  ) : isRecognizing ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}