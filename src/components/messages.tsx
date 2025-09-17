'use client';

import { ReactNode } from 'react';
import { User, Bot, FileImage, FileVideo, FileAudio } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import Image from 'next/image';

export function Message({ children, isUser = false }: { children: ReactNode; isUser?: boolean }) {
  return (
    <div className={`flex items-start gap-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback><Bot /></AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-lg sm:max-w-xl rounded-xl px-4 py-3 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
        {children}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback><User /></AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function UserMessage({ content, file }: { content: string; file: {dataUrl: string, type: string} | null }) {
    return (
        <div className="space-y-2">
            {file && (
                 <div className="relative h-24 w-24 rounded-lg overflow-hidden border">
                    {file.type.startsWith('image/') ? (
                        <Image src={file.dataUrl} alt="uploaded content" layout="fill" objectFit="cover" />
                    ) : file.type.startsWith('video/') ? (
                        <div className="flex flex-col gap-2 items-center justify-center h-full bg-muted text-muted-foreground text-xs p-2">
                            <FileVideo className="h-8 w-8"/>
                            <span>Video</span>
                        </div>
                    ) : file.type.startsWith('audio/') ? (
                        <div className="flex flex-col gap-2 items-center justify-center h-full bg-muted text-muted-foreground text-xs p-2">
                            <FileAudio className="h-8 w-8"/>
                            <span>Audio</span>
                        </div>
                    ) : null }
                </div>
            )}
            {content && <p>{content}</p>}
        </div>
    )
}
