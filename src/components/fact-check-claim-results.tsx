
'use client';

import { FactCheckClaimOutput } from '@/ai/flows/fact-check-claim';
import { ResultCard } from '@/components/ui/result-card';
import { BadgeCheck, BadgeX, AlertTriangle, HelpCircle } from 'lucide-react';

interface FactCheckClaimResultsProps {
  result: FactCheckClaimOutput;
}

const verdictIcons = {
  'True': <BadgeCheck className="text-green-500" />,
  'False': <BadgeX className="text-red-500" />,
  'Misleading': <AlertTriangle className="text-yellow-500" />,
  'Uncertain': <HelpCircle className="text-gray-500" />,
};

const verdictColors = {
    'True': 'text-green-500',
    'False': 'text-red-500',
    'Misleading': 'text-yellow-500',
    'Uncertain': 'text-gray-500',
};

export function FactCheckClaimResults({ result }: FactCheckClaimResultsProps) {
  return (
    <ResultCard
      title="Fact-Check Results"
      icon={verdictIcons[result.verdict]}
      status={result.verdict}
      statusColor={verdictColors[result.verdict]}
    >
      <p className="text-sm text-muted-foreground mb-4">{result.explanation}</p>
      {result.evidence.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Evidence:</h4>
          <div className="space-y-2">
            {result.evidence.map((item, index) => (
              <div key={index} className="p-2 border rounded-md">
                <a href={item.source} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-semibold">
                  {item.title}
                </a>
                <p className="text-xs text-muted-foreground mt-1">{item.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </ResultCard>
  );
}
