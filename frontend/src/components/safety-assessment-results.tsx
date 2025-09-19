'use client';

import { AssessSafetyOutput, VerifySourceOutput } from '@/lib/api-client';
import { SourceInformation } from './source-information';
import { Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { getScoreColorClass, getSafetyRatingColor, getSafetyRatingIcon } from '@/lib/component-utils';
import { Progress } from '@/components/ui/progress';

interface SafetyAssessmentResultsProps {
  result: AssessSafetyOutput;
  sourceResult?: VerifySourceOutput;
}

export function SafetyAssessmentResults({ result, sourceResult }: SafetyAssessmentResultsProps) {
  const safetyRatingIcon = getSafetyRatingIcon(result.safetyRating);

  // Dynamically create the icon component based on the returned icon name
  const renderSafetyIcon = () => {
    switch (safetyRatingIcon.icon) {
      case 'CheckCircle':
        return <CheckCircle className={`h-5 w-5 ${safetyRatingIcon.className}`} />;
      case 'AlertTriangle':
        return <AlertTriangle className={`h-5 w-5 ${safetyRatingIcon.className}`} />;
      case 'Info':
        return <Info className={`h-5 w-5 ${safetyRatingIcon.className}`} />;
      default:
        return <Info className={`h-5 w-5 ${safetyRatingIcon.className}`} />;
    }
  };

  return (
    <div className="space-y-6">
      <SourceInformation sourceResult={sourceResult} />
      <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Safety Rating
        </h3>
        <div className="flex items-center gap-2">
          {renderSafetyIcon()}
          <span className={`font-bold text-xl ${getSafetyRatingColor(result.safetyRating)}`}>
            {result.safetyRating}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {result.safetyRating === 'SAFE' && 'This content appears to be safe.'}
          {result.safetyRating === 'HARMFUL' && 'This content may be harmful. Exercise caution.'}
          {result.safetyRating === 'MISLEADING' && 'This content may be misleading. Verify facts.'}
          {result.safetyRating === 'UNKNOWN' && 'Unable to determine safety rating.'}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Confidence Score</h3>
        <Progress value={result.confidenceScore * 100} indicatorClassName={getScoreColorClass(result.confidenceScore, 'safety')} />
        <p className="text-sm text-muted-foreground">
          Confidence: {(result.confidenceScore * 100).toFixed(1)}%
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Explanation</h3>
        <p className="text-muted-foreground">{result.explanation}</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Topics</h3>
        <div className="flex flex-wrap gap-2">
          {result.topics.map((topic, index) => (
            <span key={index} className="bg-secondary text-secondary-foreground px-2 py-1 rounded-full text-sm">
              {topic}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Content Analysis</h3>
        <p className="text-muted-foreground">{result.contentAnalysis}</p>
      </div>
    </div>
  );
}