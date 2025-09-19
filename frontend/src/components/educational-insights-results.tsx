// This is a new file
'use client';

import { ProvideEducationalInsightsOutput } from "@/lib/api-client";
import { Lightbulb } from "lucide-react";

import { VerifySourceOutput } from '@/ai/flows/verify-source';
import { SourceInformation } from './source-information';

interface EducationalInsightsResultsProps {
    result: ProvideEducationalInsightsOutput;
    sourceResult?: VerifySourceOutput;
}

export function EducationalInsightsResults({ result, sourceResult }: EducationalInsightsResultsProps) {
  return (
    <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" /> Analysis Report
        </h3>
        {result.insights.split('\n').filter(p => p.trim() !== '').map((paragraph, index) => (
            <p key={index} className="leading-relaxed text-muted-foreground">
            {paragraph}
            </p>
        ))}
    </div>
  );
}
