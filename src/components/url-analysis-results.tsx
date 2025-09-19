
'use client';

import { SafeSearchUrlOutput } from '@/ai/flows/safe-search-url';
import { VerifySourceOutput } from '@/ai/flows/verify-source';
import { SafeSearchResults } from './safe-search-results';
import { VerifySourceResults } from './verify-source-results';

interface UrlAnalysisResultsProps {
  result: {
    safeSearch: SafeSearchUrlOutput;
    verifySource: VerifySourceOutput;
  };
}

export function UrlAnalysisResults({ result }: UrlAnalysisResultsProps) {
  return (
    <div className="space-y-4">
      <SafeSearchResults result={result.safeSearch} />
      <VerifySourceResults result={result.verifySource} />
    </div>
  );
}
