
'use client';

import { SafeSearchUrlOutput, VerifySourceOutput } from '@/lib/api-client';
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
    <div className="space-y-6">
      {result.safeSearch && <SafeSearchResults result={result.safeSearch} />}
      {result.verifySource && <VerifySourceResults result={result.verifySource} />}
    </div>
  );
}
