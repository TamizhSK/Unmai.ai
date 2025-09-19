
'use client';

import { safeSearchUrl, SafeSearchUrlOutput } from '@/ai/flows/safe-search-url';
import { ResultCard } from '@/components/ui/result-card';
import { Shield, ShieldAlert } from 'lucide-react';

import { VerifySourceOutput } from '@/ai/flows/verify-source';
import { SourceInformation } from './source-information';

interface SafeSearchResultsProps {
  result: SafeSearchUrlOutput;
  sourceResult?: VerifySourceOutput;
}

export function SafeSearchResults({ result, sourceResult }: SafeSearchResultsProps) {
  return (
    <ResultCard
      title="Safe Search Results"
      icon={result.isSafe ? <Shield className="text-green-500" /> : <ShieldAlert className="text-red-500" />}
      status={result.isSafe ? 'Safe' : 'Unsafe'}
      statusColor={result.isSafe ? 'text-green-500' : 'text-red-500'}
    >
      <SourceInformation sourceResult={sourceResult} />
      <p className="text-sm text-muted-foreground">{result.details}</p>
      {result.threatTypes.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold">Detected Threats:</h4>
          <ul className="list-disc list-inside">
            {result.threatTypes.map((threat, index) => (
              <li key={index}>{threat}</li>
            ))}
          </ul>
        </div>
      )}
    </ResultCard>
  );
}
