'use client';

import Link from 'next/link';
import { ShieldCheck, Languages } from 'lucide-react';
import { ThemeToggle } from '@/components';
import { useLanguage } from '@/context/language-context';

const supportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'bn', name: 'Bengali' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
];

export function Header() {
  const { language, setLanguage } = useLanguage();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <span className="font-headline text-2xl font-bold text-foreground">
            Verity AI
          </span>
        </Link>
        <div className="flex items-center gap-4">
            <div className="relative flex items-center">
                <Languages className="absolute left-3 h-5 w-5 text-muted-foreground" />
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="pl-10 pr-4 py-2 border bg-transparent rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Select language"
                >
                    {supportedLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                            {lang.name}
                        </option>
                    ))}
                </select>
            </div>
            <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
