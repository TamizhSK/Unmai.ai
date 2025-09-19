'use client';

import { DetectSyntheticContentOutput } from '@/lib/api-client';
import { Bot, AlertTriangle } from 'lucide-react';
import { getScoreColorClass } from '@/lib/component-utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface DetectSyntheticContentResultsProps {
  result: DetectSyntheticContentOutput;
}

export function DetectSyntheticContentResults({ result, sourceResult }: DetectSyntheticContentResultsProps) {
  return (
    <div className="space-y-6">
      <SourceInformation sourceResult={sourceResult} />
      <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> Synthetic Content Detection
        </h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant={result.isSynthetic ? "destructive" : "default"}>
            {result.isSynthetic ? 'Likely AI-Generated' : 'Likely Authentic'}
          </Badge>
          <Badge variant="secondary">Confidence: {result.confidenceScore}%</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {result.isSynthetic 
            ? 'This content appears to be AI-generated or synthetic.' 
            : 'This content appears to be authentic and not AI-generated.'}
        </p>
        {result.isSynthetic && result.confidenceScore > 80 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>High Confidence Synthetic Content</AlertTitle>
            <AlertDescription>
              This content has been detected as AI-generated with high confidence. 
              Exercise caution when sharing or citing this content.
            </AlertDescription>
          </Alert>
        )}
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
              <Badge key={index} variant="secondary">{marker}</Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> No Markers Detected
          </h3>
          <p className="text-muted-foreground">No specific synthetic markers were detected in this content.</p>
        </div>
      )}
    </div>
  );
}