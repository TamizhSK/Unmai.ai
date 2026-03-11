'use client';

import { useState, useRef, useMemo, ChangeEvent, DragEvent, ClipboardEvent, SyntheticEvent, useEffect } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Paperclip, X, Mic, UploadCloud, ArrowUp, FileVideo, FileAudio } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from '@/context/language-context';
import { toast } from 'sonner';

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
  const { language: contextLanguage, setLanguage: setContextLanguage, translate } = useLanguage();

  const [selectedLanguage, setSelectedLanguage] = useState(contextLanguage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setSelectedLanguage(contextLanguage);
  }, [contextLanguage]);

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
      'kn-IN': 'KN',
      'ml-IN': 'ML'
    };
    return codes[lang] || 'EN';
  };

  // Dynamic placeholder based on current state (short, compact labels)
  const placeholder = useMemo(() => {
    if (isRecording) return 'Recording…';
    if (isRecognizing) return 'Listening…';
    if (file) return 'Add a note';
    if (input.trim()) return 'Ready';
    return 'Type text, paste URL, or add image/video/audio';
  }, [isRecording, isRecognizing, file, input]);

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
        toast.error("Microphone unavailable", {
          description: "Access denied or not supported. Please check your browser permissions.",
        });
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
      <div 
        className="relative w-full rounded-2xl sm:rounded-full p-[2px] shadow-sm"
        style={{
          backgroundImage: 'linear-gradient(to right, #4285F4 0%, #DB4437 33%, #F4B400 66%, #0F9D58 100%)'
        }}
      >
        <form
          onSubmit={handleSubmit}
          onDragEnter={handleDragEnter}
          className={`relative w-full rounded-2xl sm:rounded-full bg-background p-2 sm:p-3 px-2 sm:px-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 transition-all ${isDragging ? 'ring-2 ring-primary ring-offset-2' : ''}`}
        >
        {/* Drag overlay */}
        {isDragging && (
          <div 
            className="absolute inset-0 rounded-2xl sm:rounded-full flex items-center justify-center z-50 bg-background/95 backdrop-blur-sm border-2 border-dashed border-primary"
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <UploadCloud className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <p className="text-xs sm:text-sm text-primary">Drop file</p>
            </div>
          </div>
        )}
        {/* File preview if exists */}
        {file && (
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded-lg">
            {file.type.startsWith('image/') ? (
              <div className="relative h-7 w-7 sm:h-8 sm:w-8 rounded overflow-hidden flex-shrink-0">
                <Image src={file.dataUrl} alt={file.name} fill className="object-cover" />
              </div>
            ) : file.type.startsWith('video/') ? (
              <FileVideo className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            ) : file.type.startsWith('audio/') ? (
              <FileAudio className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            ) : (
              <Paperclip className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            )}
            <span className="text-xs text-foreground truncate max-w-[100px] sm:max-w-[140px]">
              {file.name}
            </span>
            <Button
              type="button"
              onClick={() => setFile(null)}
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full ml-auto flex-shrink-0 hover:bg-transparent"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        {/* Textarea - flexible width */}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[36px] sm:min-h-[40px] max-h-32 text-sm sm:text-base leading-snug placeholder:text-muted-foreground"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              const ne: any = e.nativeEvent as any;
              if (ne?.isComposing) return;
              if (isLoading || isRecognizing || isRecording) return;
              e.preventDefault();
              handleSubmit(e as unknown as SyntheticEvent);
            }
          }}
          disabled={isLoading || isRecognizing || isRecording}
        />
        
        {/* Action buttons */}
        <div className="flex items-center w-full sm:w-auto justify-between sm:justify-start gap-2 sm:gap-1">
          {/* Left: Language Selector */}
          <div className="flex items-center justify-start">
            <Select value={selectedLanguage} onValueChange={(value) => {
              setSelectedLanguage(value);
              setContextLanguage(value);
            }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger
                    aria-label={`Language: ${getLanguageCode(selectedLanguage)}`}
                    className="h-8 w-10 sm:w-12 border-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-xs font-medium [&>svg]:hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <span className="text-center w-full">{getLanguageCode(selectedLanguage)}</span>
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select Language</p>
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                <SelectItem value="en-US">English</SelectItem>
                <SelectItem value="hi-IN">हिन्दी</SelectItem>
                <SelectItem value="bn-IN">বাংলা</SelectItem>
                <SelectItem value="ta-IN">தமிழ்</SelectItem>
                <SelectItem value="te-IN">తెలుగు</SelectItem>
                <SelectItem value="mr-IN">मराठी</SelectItem>
                <SelectItem value="gu-IN">ગુજરાતી</SelectItem>
                <SelectItem value="kn-IN">ಕನ್ನಡ</SelectItem>
                <SelectItem value="ml-IN">മലയാളം</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Right cluster: Attach + Mic + Send */}
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  variant="default"
                  size="icon"
                  aria-label={translate('input.attachFile')}
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{translate('input.attachFile')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={handleMicClick}
                  disabled={isLoading}
                  variant={isRecording || isRecognizing ? "destructive" : "default"}
                  size="icon"
                  aria-label={isRecording ? translate('input.stopRecording') : isRecognizing ? translate('input.stopRecognition') : translate('input.startVoice')}
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isRecording ? translate('input.stopRecording') :
                   isRecognizing ? translate('input.stopRecognition') :
                   translate('input.startVoice')}
                </p>
              </TooltipContent>
            </Tooltip>

            <Button
              type="submit"
              disabled={isLoading || (!input.trim() && !file)}
              variant="default"
              size="icon"
              aria-label="Send"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          onChange={handleFileChange}
          className="hidden"
        />
        </form>
      </div>
    </TooltipProvider>
  );
}