'use client';

import { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Paperclip, Send, X } from 'lucide-react';
import Image from 'next/image';

interface InputBarProps {
  onSubmit: (input: string, file: {dataUrl: string, type: string} | null) => void;
  disabled: boolean;
}

export function InputBar({ onSubmit, disabled }: InputBarProps) {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<{dataUrl: string, name: string, type: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || (!input.trim() && !file)) return;
    onSubmit(input, file ? {dataUrl: file.dataUrl, type: file.type} : null);
    setInput('');
    setFile(null);
  };
  
  return (
    <form onSubmit={handleSubmit} className="relative rounded-xl bg-secondary/80 p-2 flex flex-col gap-2">
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
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className='flex-shrink-0'
            >
                <Paperclip />
                <span className="sr-only">Attach file</span>
            </Button>
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
                placeholder="Analyze text, a URL, or upload an image/video/audio..."
                className="flex-1 resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 self-center"
                rows={1}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                    }
                }}
                disabled={disabled}
            />
            <Button type="submit" size="icon" disabled={disabled || (!input.trim() && !file)} className='flex-shrink-0'>
                <Send />
                <span className="sr-only">Submit</span>
            </Button>
        </div>
    </form>
  );
}
