'use client';

import { z } from 'zod';
import { VerifySourceOutputSchema } from '@/ai/flows/verify-source';
import { Progress } from '@/components/ui/progress';
import { BadgeCheck, ExternalLink, Search, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { getScoreColorClass } from '@/lib/component-utils';

interface VerifySourceResultsProps {
  result: z.infer<typeof VerifySourceOutputSchema>;
}

export function VerifySourceResults({ result }: VerifySourceResultsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-primary" /> Source Verification
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-secondary/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Source Verified</p>
            <p className={`font-bold text-lg ${result.sourceVerified ? 'text-green-500' : 'text-destructive'}`}>
              {result.sourceVerified ? 'Yes' : 'No'}
            </p>
          </div>
          
          <div className="bg-secondary/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Origin Traced</p>
            <p className={`font-bold text-lg ${result.originTraced ? 'text-green-500' : 'text-destructive'}`}>
              {result.originTraced ? 'Yes' : 'No'}
            </p>
          </div>
          
          <div className="bg-secondary/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Credibility Score</p>
            <p className="font-bold text-lg">{result.sourceCredibility}/100</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <h4 className="font-medium">Credibility</h4>
          <Progress value={result.sourceCredibility} indicatorClassName={getScoreColorClass(result.sourceCredibility)} />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" /> Verification Details
        </h3>
        <p className="text-muted-foreground">{result.verificationDetails}</p>
      </div>

      {result.relatedSources && result.relatedSources.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Related Sources</h3>
          <div className="space-y-2">
            {result.relatedSources.map((source, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between">
                  <h4 className="font-medium">{source.title}</h4>
                  <span className="text-sm text-muted-foreground">{source.similarity}% match</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Link 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {source.url}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!result.relatedSources || result.relatedSources.length === 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" /> No Related Sources
          </h3>
          <p className="text-muted-foreground">No related sources were found during verification.</p>
        </div>
      )}
    </div>
  );
}