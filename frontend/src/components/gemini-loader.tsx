'use client';

import { cn } from "@/lib/utils";
import "./gemini-loader.css";

export function GeminiLoaderRing({ className }: { className?: string }) {
  return (
    <div className={cn("relative inline-block h-4 w-4", className)} role="status" aria-label="Loading">
      <div className="gemini-loader-ring absolute inset-0" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function GeminiLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center", className)}>
      <GeminiLoaderRing className="h-4 w-4" />
      <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
    </div>
  );
}