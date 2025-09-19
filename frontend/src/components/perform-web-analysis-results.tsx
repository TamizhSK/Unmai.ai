'use client';

import { PerformWebAnalysisOutput } from '@/lib/api-client';
import Link from 'next/link';
import { Search, ExternalLink, AlertTriangle } from 'lucide-react';

interface PerformWebAnalysisResultsProps {
  result: PerformWebAnalysisOutput;
}

export function PerformWebAnalysisResults({ result, sourceResult }: PerformWebAnalysisResultsProps) {
  return (
    <div className="space-y-6">
      <SourceInformation sourceResult={sourceResult} />
      <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" /> Real-time Web Analysis
        </h3>
        <p className={`font-medium ${result.realTimeFactCheck ? 'text-success' : 'text-destructive'}`}>
          {result.realTimeFactCheck ? 'Analysis Completed' : 'Analysis Failed'}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Analysis Summary</h3>
        <p className="text-muted-foreground">{result.analysisSummary}</p>
      </div>

      {result.currentInformation && result.currentInformation.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Current Information</h3>
          <div className="space-y-3">
            {result.currentInformation.map((info, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h4 className="font-medium">{info.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Link 
                    href={info.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {info.url}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <span className="text-xs text-muted-foreground">({info.date})</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{info.snippet}</p>
                <div className="mt-2">
                  <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                    Relevance: {info.relevance}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> No Current Information
          </h3>
          <p className="text-muted-foreground">No current information was found during the analysis.</p>
        </div>
      )}

      {result.informationGaps && result.informationGaps.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Information Gaps</h3>
          <ul className="list-disc pl-5 space-y-1">
            {result.informationGaps.map((gap, index) => (
              <li key={index} className="text-muted-foreground">{gap}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}