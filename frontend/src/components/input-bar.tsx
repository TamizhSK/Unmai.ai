'use client';

import { useState, useRef, ChangeEvent, FormEvent, DragEvent, ClipboardEvent, SyntheticEvent } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { RainbowButton } from './ui/rainbow-button';
import { Paperclip, Send, X, Mic, UploadCloud, Languages, ArrowUp, FileVideo, FileAudio } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InputBarProps {
  addMessage: (message: any) => void;
  removeLastMessage: () => void;
  setShowChat: (show: boolean) => void;
  showChat: boolean;
  isLoading: boolean;
}

export function InputBar({ addMessage, removeLastMessage, setShowChat, showChat, isLoading }: InputBarProps) {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<{ dataUrl: string, name: string, type: string } | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Helper function to get language code
  const getLanguageCode = (lang: string) => {
    const codes: { [key: string]: string } = {
      'en-US': 'EN',
      'hi-IN': 'HI',
      'bn-IN': 'BN',
      'ta-IN': 'TA',
      'te-IN': 'TL',
      'mr-IN': 'MR',
      'gu-IN': 'GU',
      'kn-IN': 'KN'
    };
    return codes[lang] || 'EN';
  };

  // Dynamic placeholder based on current state
  const getPlaceholder = () => {
    if (isRecording) return "Recording audio...";
    if (isRecognizing) return "Listening...";
    if (file) {
      if (file.type.startsWith('image/')) return "Add your question or analysis request";
      if (file.type.startsWith('video/')) return "Add your question or analysis request";
      if (file.type.startsWith('audio/')) return "Add your question or analysis request";
    }
    if (input.trim()) return "Ready to analyze your content";
    return "Analyze text, URL, or paste/drop an image, video, or audio file...";
  };

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

  const handleMicClick = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        // Don't set isRecording(false) here - let the onstop callback handle it
      } else {
        // If not actually recording, just reset the state
        setIsRecording(false);
      }
      return;
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        
        // Convert to base64 for backend processing
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          // Set as file for processing
          setFile({
            dataUrl: reader.result as string,
            name: `Audio Recording`,
            type: 'audio/webm'
          });
        };
        reader.readAsDataURL(audioBlob);
        
        setIsRecording(false);
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      
      // Fallback to browser speech recognition if available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition && !isRecognizing) {
        handleSpeechRecognition();
      } else {
        alert("Microphone access denied or not supported. Please check your browser permissions.");
      }
    }
  };

  const handleSpeechRecognition = () => {
    if (isRecognizing) {
      recognitionRef.current?.stop();
      setIsRecognizing(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = selectedLanguage;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      setInput(finalTranscript || interimTranscript);
    };

    recognition.onend = () => {
      setIsRecognizing(false);
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecognizing(false);
    };

    recognition.start();
    setIsRecognizing(true);
  };

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (isLoading || (!input.trim() && !file)) return;
    
    if (!showChat) {
      setShowChat(true);
    }

    const userMessage = {
      type: 'user',
      input,
      file,
      language: selectedLanguage,
      contentType: file?.type.split('/')[0] || (input.match(/^https?:\/\//) ? 'url' : 'text')
    };
    addMessage(userMessage);
    setInput('');
    setFile(null);
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

  return (
    <TooltipProvider>
      <div className="relative p-0.5 rounded-xl mb-8 sm:mb-12 lg:mb-16 bg-[linear-gradient(to_right,#4285F4,#EA4335,#FBBC05,#34A853)] input-focus-glow">
        <form
          onSubmit={handleSubmit}
          onDragEnter={handleDragEnter}
          className="relative rounded-xl bg-background p-2 sm:p-3 flex flex-col gap-2 sm:gap-3"
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
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border/50 w-fit group">
            <div className="flex items-center gap-2">
              {file.type.startsWith('image/') ? (
                <>
                  <div className="relative h-8 w-8 rounded overflow-hidden bg-muted">
                    <Image src={file.dataUrl} alt={file.name} fill style={{ objectFit: 'cover' }} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{file.name}</span>
                </>
              ) : file.type.startsWith('video/') ? (
                <>
                  <div className="h-8 w-8 rounded bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <FileVideo className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{file.name}</span>
                </>
              ) : file.type.startsWith('audio/') ? (
                <>
                  <div className="h-8 w-8 rounded bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <FileAudio className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{file.name}</span>
                </>
              ) : (
                <>
                  <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-900/20 flex items-center justify-center">
                    <Paperclip className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{file.name}</span>
                </>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-destructive hover:text-destructive-foreground opacity-70 hover:opacity-100 transition-all"
              onClick={() => setFile(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {/* Text input area in its own flex container */}
        <div className="flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder={getPlaceholder()}
            className={`resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[60px] transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                // Avoid submit while using IME composition or when loading/recognizing
                const ne: any = e.nativeEvent as any;
                if (ne?.isComposing) return;
                if (isLoading || isRecognizing || isRecording) return;
                e.preventDefault();
                handleSubmit(e as unknown as SyntheticEvent);
              }
            }}
            disabled={isLoading || isRecognizing || isRecording}
          />
          
          {/* Action buttons - left side */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    size="icon" 
                    className="h-8 w-8 rounded-full" 
                    disabled={isLoading || isRecognizing} 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Attach file</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    size="icon" 
                    className={`h-8 w-8 rounded-full relative overflow-hidden ${(isRecording || isRecognizing) ? 'bg-[#DB4437] text-white hover:bg-[#DB4437]/90' : ''}`}
                    disabled={isLoading}
                    onClick={handleMicClick}
                  >
                    <div className="relative flex items-center justify-center z-10">
                      <Mic className="h-4 w-4" />
                    </div>
                    {isRecording && (
                      <>
                        {/* Ripple effect */}
                        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
                        <div className="absolute inset-1 rounded-full bg-white/10 animate-ping" style={{ animationDelay: '0.5s' }} />
                        {/* Recording indicator bars */}
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                          <div className="w-0.5 h-1 bg-white rounded-full animate-pulse" />
                          <div className="w-0.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
                          <div className="w-0.5 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                        </div>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isRecording ? 'Stop Recording' : 
                     isRecognizing ? 'Stop Recognition' : 
                     'Start Voice Input'}
                  </p>
                </TooltipContent>
              </Tooltip>

              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="h-8 w-8 p-0 [&>svg:last-child]:hidden flex items-center justify-center border bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-xs font-bold" aria-label="Change language">
                  <span>{getLanguageCode(selectedLanguage)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English</SelectItem>
                  <SelectItem value="hi-IN">Hindi</SelectItem>
                  <SelectItem value="bn-IN">Bengali</SelectItem>
                  <SelectItem value="ta-IN">Tamil</SelectItem>
                  <SelectItem value="te-IN">Telugu</SelectItem>
                  <SelectItem value="mr-IN">Marathi</SelectItem>
                  <SelectItem value="gu-IN">Gujarati</SelectItem>
                  <SelectItem value="kn-IN">Kannada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Send button - right corner */}
            <RainbowButton 
              type="submit"
              className="h-8 w-8 rounded-full p-0 min-w-8"
              disabled={isRecognizing || (!input.trim() && !file && !isLoading)}
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </RainbowButton>
          </div>
        </div>
        </form>
      </div>
    </TooltipProvider>
  );
}