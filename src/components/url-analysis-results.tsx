
'use client';

import { SafeSearchUrlOutput } from '@/ai/flows/safe-search-url';
import { VerifySourceOutput } from '@/ai/flows/verify-source';
import { SafeSearchResults } from './safe-search-results';
import { VerifySourceResults } from './verify-source-results';

import { PerformWebAnalysisOutput } from '@/ai/flows/perform-web-analysis';
import { PerformWebAnalysisResults } from './perform-web-analysis-results';

interface UrlAnalysisResultsProps {
  result: {
    safeSearch: SafeSearchUrlOutput;
    verifySource: VerifySourceOutput;
    webAnalysis: PerformWebAnalysisOutput;
  };
  sourceResult?: VerifySourceOutput;
}

export function UrlAnalysisResults({ result, sourceResult }: UrlAnalysisResultsProps) {
  return (
    <div className="space-y-4">
      <SafeSearchResults result={result.safeSearch} sourceResult={sourceResult} />
      <VerifySourceResults result={result.verifySource} sourceResult={sourceResult} />
      <PerformWebAnalysisResults result={result.webAnalysis} sourceResult={sourceResult} />
    </div>
  );
}
