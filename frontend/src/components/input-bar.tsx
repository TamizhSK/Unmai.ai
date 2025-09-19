'use client';

import { useState, useRef, ChangeEvent, FormEvent, DragEvent, ClipboardEvent } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Paperclip, Send, X, Mic, Square, UploadCloud, Languages } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InputBarProps {
  onSubmit: (input: string, file: { dataUrl: string, type: string } | null, language: string) => void;
  disabled: boolean;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
}

export function InputBar({ onSubmit, disabled, selectedLanguage, onLanguageChange }: InputBarProps) {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<{ dataUrl: string, name: string, type: string } | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || (!input.trim() && !file)) return;
    onSubmit(input, file ? { dataUrl: file.dataUrl, type: file.type } : null, selectedLanguage);
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
      <form
        onSubmit={handleSubmit}
        onDragEnter={handleDragEnter}
        className="relative rounded-xl bg-background border p-2 flex flex-col gap-2"
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
          <div className="relative group w-fit">
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
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={disabled || isRecognizing}>
                <Paperclip />
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder="Analyze text, a URL, or paste/drop an image, video, or audio file..."
            className="flex-1 resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={disabled || isRecognizing}
          />
          <Select value={selectedLanguage} onValueChange={onLanguageChange}>
            <SelectTrigger className="w-fit">
              <Languages className="h-5 w-5" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US">English</SelectItem>
              <SelectItem value="es-ES">Español</SelectItem>
              <SelectItem value="fr-FR">Français</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" size="icon" disabled={disabled || isRecognizing || (!input.trim() && !file)}>
            <Send />
          </Button>
        </div>
      </form>
    </TooltipProvider>
  );
}
