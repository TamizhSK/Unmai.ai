'use client';
import { useState, useEffect } from 'react';
import { explainMisleadingIndicators } from '@/lib/api-client';
import { Skeleton } from './ui/skeleton';

export function IndicatorExplanation({ indicator }: { indicator: string }) {
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getExplanation() {
      if (!indicator) return;
      setIsLoading(true);
      try {
        // Construct a more specific prompt for the AI
        const contentForAI = `Explain why the following indicator in a piece of content might be misleading: "${indicator}"`;
        const result = await explainMisleadingIndicators({ content: contentForAI });
        setExplanation(result.explanation);
      } catch (e) {
        console.error("Failed to get explanation for indicator:", e);
        setExplanation('Could not load a detailed explanation at this time.');
      } finally {
        setIsLoading(false);
      }
    }
    getExplanation();
  }, [indicator]);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }

  return <p className="text-muted-foreground">{explanation}</p>;
}
