
'use client';

import { z } from 'zod';
import { SafeSearchUrlOutput } from '@/lib/api-client';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { ResultCard } from '@/components';

interface SafeSearchResultsProps {
  result: SafeSearchUrlOutput;
}

export function SafeSearchResults({ result }: SafeSearchResultsProps) {
  const getSafetyIcon = (flagged: boolean) => {
    return flagged ? <AlertTriangle className="text-destructive" /> : <CheckCircle className="text-success" />;
  };

  const getSafetyStatus = (flagged: boolean) => {
    return flagged ? 'Flagged' : 'Safe';
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" /> Content Safety Assessment
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <ResultCard 
          title="Adult Content" 
          icon={getSafetyIcon(result.adult)}
          status={getSafetyStatus(result.adult)}
        >
          <p className="text-sm">{getSafetyStatus(result.adult)}</p>
        </ResultCard>
        <ResultCard 
          title="Violence" 
          icon={getSafetyIcon(result.violence)}
          status={getSafetyStatus(result.violence)}
        >
          <p className="text-sm">{getSafetyStatus(result.violence)}</p>
        </ResultCard>
        <ResultCard 
          title="Medical" 
          icon={getSafetyIcon(result.medical)}
          status={getSafetyStatus(result.medical)}
        >
          <p className="text-sm">{getSafetyStatus(result.medical)}</p>
        </ResultCard>
        <ResultCard 
          title="Racy" 
          icon={getSafetyIcon(result.racy)}
          status={getSafetyStatus(result.racy)}
        >
          <p className="text-sm">{getSafetyStatus(result.racy)}</p>
        </ResultCard>
        <ResultCard 
          title="Spoof" 
          icon={getSafetyIcon(result.spoof)}
          status={getSafetyStatus(result.spoof)}
        >
          <p className="text-sm">{getSafetyStatus(result.spoof)}</p>
        </ResultCard>
      </div>
    </div>
  );
}
