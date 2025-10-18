'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components';

export function SimpleHeader() {
  return (
<header className="fixed top-0 left-0 right-0 z-50 w-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
  <div className="pt-[env(safe-area-inset-top)]">
    <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
      <Link href="/" className="flex items-center">
        <Image 
          src="/favicon.ico" 
          alt="unmai.ai" 
          width={32} 
          height={32} 
          className="h-8 w-8"
          priority
        />
      </Link>
      <div>
        <ThemeToggle />
      </div>
    </div>
  </div>
</header>
  );
}
