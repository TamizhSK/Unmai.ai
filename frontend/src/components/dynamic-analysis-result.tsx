'use client';

import { AnalysisResults } from '@/components/analysis-results';
import { EducationalInsightsResults } from '@/components/educational-insights-results';
import { SafetyAssessmentResults } from '@/components/safety-assessment-results';
import { VerifySourceResults } from '@/components/verify-source-results';
import { PerformWebAnalysisResults } from '@/components/perform-web-analysis-results';
import { DetectSyntheticContentResults } from '@/components/detect-synthetic-content-results';
import { AnalyzeContentResults } from '@/components/analyze-content-results';
import { UnifiedDeepfakeAnalysis } from '@/components/unified-deepfake-analysis';
import { SafeSearchResults } from './safe-search-results';
import { FactCheckClaimResults } from './fact-check-claim-results';
import { UrlAnalysisResults } from './url-analysis-results';
import { AnalysisTask } from './unified-analysis-client';

interface DynamicAnalysisResultProps {
  task: AnalysisTask;
  result: any;
  sourceResult?: any;
}

export function DynamicAnalysisResult({ task, result, sourceResult }: DynamicAnalysisResultProps) {
  switch (task) {
    case 'credibility':
      return <AnalysisResults result={result} />;
    case 'deepfake':
      return <UnifiedDeepfakeAnalysis deepfakeResult={result} sourceResult={sourceResult} />;
    case 'insights':
      return <EducationalInsightsResults result={result} />;
    case 'safety':
      return <SafetyAssessmentResults result={result} />;
    case 'verify-source':
      return <VerifySourceResults result={result} />;
    case 'web-analysis':
      return <PerformWebAnalysisResults result={result} />;
    case 'synthetic-content':
      return <DetectSyntheticContentResults result={result} />;
    case 'misinformation':
      return <AnalyzeContentResults result={result} />;
    case 'safe-search':
      return <SafeSearchResults result={result} />;
    case 'fact-check':
      return <FactCheckClaimResults result={result} />;
    case 'url-analysis':
      return <UrlAnalysisResults result={result} />;
    default:
      return <div className="text-destructive">Error: Unknown analysis task '{task}'</div>;
  }
}
