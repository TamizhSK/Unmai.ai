'use client';

import { GetCredibilityScoreOutput } from '@/ai/flows/get-credibility-score';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Info, Globe } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IndicatorExplanation } from './indicator-explanation';
import { getScoreColorClass, getScoreTextColorClass } from '@/lib/component-utils';

interface AnalysisResultsProps {
  result: GetCredibilityScoreOutput;
}

export function AnalysisResults({ result }: AnalysisResultsProps) {
  return (
    <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <h3 className="font-semibold text-lg">Credibility Score</h3>
            <span className={`font-bold text-2xl ${getScoreTextColorClass(result.credibilityScore, 'credibility')}`}>
              {result.credibilityScore} / 100
            </span>
          </div>
          <Progress value={result.credibilityScore} indicatorClassName={getScoreColorClass(result.credibilityScore, 'credibility')} />
          <p className="text-sm text-muted-foreground">
            {result.credibilityScore < 40 ? "Low credibility. Be very cautious with this information." : result.credibilityScore < 70 ? "Medium credibility. Exercise caution and verify facts." : "High credibility. Appears to be trustworthy."}
          </p>
        </div>
        
        {result.source && (
          <div className="space-y-2">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Globe className="h-5 w-5 text-primary"/> Source</h3>
            <p className="text-muted-foreground font-medium capitalize">{result.source}</p>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="font-semibold text-lg flex items-center gap-2"><Info className="h-5 w-5 text-primary"/> Assessment Summary</h3>
          <p className="text-muted-foreground">{result.assessmentSummary}</p>
        </div>

        {result.misleadingIndicators && result.misleadingIndicators.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive"/> Misleading Indicators Found</h3>
            <Accordion type="single" collapsible className="w-full">
              {result.misleadingIndicators.map((indicator, index) => (
                <AccordionItem value={`item-${index}`} key={index}>
                  <AccordionTrigger className="text-left">{indicator}</AccordionTrigger>
                  <AccordionContent>
                    <IndicatorExplanation indicator={indicator} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : (
             <div className="space-y-2 text-green-500">
                <h3 className="font-semibold text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5"/> No Major Misleading Indicators Found</h3>
                <p className="text-sm text-muted-foreground">Our analysis did not find common signs of misinformation in this content.</p>
             </div>
        )}
    </div>
  );
}
