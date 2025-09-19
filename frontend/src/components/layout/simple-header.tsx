'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components';

export function SimpleHeader() {
  return (
<header className="fixed top-0 left-0 right-0 z-50 w-full bg-background">
  <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
    <Link href="/" className="flex items-center">
      <ShieldCheck className="h-8 w-8 text-primary" />
    </Link>
    <div>
      <ThemeToggle />
    </div>
  </div>
</header>
  );
}