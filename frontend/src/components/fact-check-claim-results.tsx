
'use client';

import { FactCheckClaimOutput } from '@/lib/api-client';
import { BadgeCheck, BadgeX, AlertTriangle, HelpCircle, Info } from 'lucide-react';
import { ResultCard } from '@/components';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

interface FactCheckClaimResultsProps {
  result: FactCheckClaimOutput;
}

const verdictIcons = {
  'True': <BadgeCheck className="text-success" />,
  'False': <BadgeX className="text-destructive" />,
  'Misleading': <AlertTriangle className="text-amber-500" />,
  'Uncertain': <HelpCircle className="text-gray-500" />,
};

const verdictColors = {
    'True': 'text-success',
    'False': 'text-destructive',
    'Misleading': 'text-amber-500',
    'Uncertain': 'text-gray-500',
};

export function FactCheckClaimResults({ result }: FactCheckClaimResultsProps) {
  const getBadgeVariant = (verdict: string) => {
    switch (verdict) {
      case 'True': return 'default';
      case 'False': return 'destructive';
      case 'Misleading': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <ResultCard
      title="Fact-Check Results"
      icon={verdictIcons[result.verdict]}
      status={result.verdict}
      statusColor={verdictColors[result.verdict]}
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant={getBadgeVariant(result.verdict)}>{result.verdict}</Badge>
        {result.confidence && <Badge variant="secondary">Confidence: {result.confidence}%</Badge>}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Info className="h-4 w-4 mr-1" />
              Details
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Fact-Check Analysis Details</DialogTitle>
              <DialogDescription>
                Detailed breakdown of the fact-check analysis
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Verdict Explanation</h4>
                <p className="text-sm text-muted-foreground">{result.explanation}</p>
              </div>
              {result.reasoningSteps && result.reasoningSteps.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Reasoning Steps</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    {result.reasoningSteps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              {result.confidence && (
                <div>
                  <h4 className="font-semibold mb-2">Confidence Level</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${result.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{result.confidence}%</span>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{result.explanation}</p>
      {result.evidence.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Evidence:</h4>
          <div className="space-y-2">
            {result.evidence.map((item, index) => (
              <div key={index} className="p-2 border rounded-md">
                <a href={item.source} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
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
