'use client';

import { z } from 'zod';
import { AnalyzeContentOutputSchema } from '@/ai/flows/analyze-content-for-misinformation';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Info } from 'lucide-react';
import { getScoreColorClass, getScoreTextColorClass } from '@/lib/component-utils';

interface AnalyzeContentResultsProps {
  result: z.infer<typeof AnalyzeContentOutputSchema>;
}

export function AnalyzeContentResults({ result }: AnalyzeContentResultsProps) {
  const getMisinformationLabel = (score: number) => {
    if (score > 0.7) return 'High Potential';
    if (score > 0.4) return 'Medium Potential';
    return 'Low Potential';
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" /> Misinformation Analysis
        </h3>
        <div className="flex items-center gap-2">
          <span className={`font-bold text-xl ${getScoreTextColorClass(result.misinformationPotential * 100, 'confidence')}`}>
            {getMisinformationLabel(result.misinformationPotential)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {result.misinformationPotential > 0.7 
            ? 'This content has a high potential for misinformation. Exercise caution.' 
            : result.misinformationPotential > 0.4 
            ? 'This content has a medium potential for misinformation. Verify facts.' 
            : 'This content has a low potential for misinformation.'}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Misinformation Potential</h3>
        <Progress value={result.misinformationPotential * 100} indicatorClassName={getScoreColorClass(result.misinformationPotential, 'confidence')} />
        <p className="text-sm text-muted-foreground">
          Score: {(result.misinformationPotential * 100).toFixed(1)}%
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" /> Explanation
        </h3>
        <p className="text-muted-foreground">{result.explanation}</p>
      </div>

      {result.sourceReliability && (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Source Reliability</h3>
          <p className="text-muted-foreground">{result.sourceReliability}</p>
        </div>
      )}
    </div>
  );
}