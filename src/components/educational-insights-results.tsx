// This is a new file
'use client';

import { ProvideEducationalInsightsOutput } from "@/ai/flows/provide-educational-insights";
import { Lightbulb } from "lucide-react";

interface EducationalInsightsResultsProps {
    result: ProvideEducationalInsightsOutput;
}

export function EducationalInsightsResults({ result }: EducationalInsightsResultsProps) {
  return (
    <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500"/> Analysis Report</h3>
        {result.insights.split('\n').filter(p => p.trim() !== '').map((paragraph, index) => (
            <p key={index} className="leading-relaxed text-muted-foreground">
            {paragraph}
            </p>
        ))}
    </div>
  );
}
