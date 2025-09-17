// This is a new file
'use client';

import { DetectDeepfakeOutput } from "@/ai/flows/detect-deepfake";
import { Progress } from "./ui/progress";

interface DeepfakeResultsProps {
    result: DetectDeepfakeOutput;
}

export function DeepfakeResults({ result }: DeepfakeResultsProps) {
    const getScoreColorClass = (score: number) => {
        if (score > 75) return 'bg-destructive';
        if (score > 40) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h3 className="font-semibold text-lg">Manipulation Likelihood</h3>
                <Progress value={result.confidenceScore} indicatorClassName={getScoreColorClass(result.confidenceScore)} />
                <p className="text-sm text-muted-foreground">
                    Our analysis indicates a {result.confidenceScore}% likelihood that this media has been manipulated or is a deepfake.
                </p>
            </div>
             <div className="space-y-2">
              <h3 className="font-semibold text-lg">Verdict</h3>
              <p className={`font-bold text-xl ${result.isDeepfake ? 'text-destructive' : 'text-green-500'}`}>
                {result.isDeepfake ? "Likely Manipulated / Deepfake" : "Likely Authentic"}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Detailed Analysis</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{result.analysis}</p>
            </div>
        </div>
    );
}
