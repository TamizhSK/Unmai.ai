'use client';

import { z } from 'zod';
import { DetectSyntheticContentOutputSchema } from '@/ai/flows/detect-synthetic-content';
import { Progress } from '@/components/ui/progress';
import { Bot, AlertTriangle } from 'lucide-react';
import { getScoreColorClass } from '@/lib/component-utils';

import { VerifySourceOutput } from '@/ai/flows/verify-source';
import { SourceInformation } from './source-information';

interface DetectSyntheticContentResultsProps {
  result: z.infer<typeof DetectSyntheticContentOutputSchema>;
  sourceResult?: VerifySourceOutput;
}

export function DetectSyntheticContentResults({ result, sourceResult }: DetectSyntheticContentResultsProps) {
  return (
    <div className="space-y-6">
      <SourceInformation sourceResult={sourceResult} />
      <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> Synthetic Content Detection
        </h3>
        <p className={`font-bold text-xl ${result.isSynthetic ? 'text-destructive' : 'text-green-500'}`}>
          {result.isSynthetic ? 'Likely AI-Generated' : 'Likely Authentic'}
        </p>
        <p className="text-sm text-muted-foreground">
          {result.isSynthetic 
            ? 'This content appears to be AI-generated or synthetic.' 
            : 'This content appears to be authentic and not AI-generated.'}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Confidence Score</h3>
        <Progress value={result.confidenceScore} indicatorClassName={getScoreColorClass(result.confidenceScore, 'confidence')} />
        <p className="text-sm text-muted-foreground">
          Confidence: {result.confidenceScore}%
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Analysis</h3>
        <p className="text-muted-foreground">{result.analysis}</p>
      </div>

      {result.markersDetected && result.markersDetected.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Detected Markers</h3>
          <div className="flex flex-wrap gap-2">
            {result.markersDetected.map((marker, index) => (
              <span key={index} className="bg-secondary text-secondary-foreground px-2 py-1 rounded-full text-sm">
                {marker}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" /> No Markers Detected
          </h3>
          <p className="text-muted-foreground">No specific synthetic markers were detected in this content.</p>
        </div>
      )}
    </div>
  );
}