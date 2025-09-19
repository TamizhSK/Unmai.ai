'use client';

import { DetectDeepfakeOutput } from "@/ai/flows/detect-deepfake";
import { VerifySourceOutput } from "@/ai/flows/verify-source";
import { Progress } from "@/components/ui/progress";
import { BadgeCheck, AlertTriangle, Info } from 'lucide-react';
import { getScoreColorClass, getScoreTextColorClass } from '@/lib/component-utils';

interface UnifiedDeepfakeAnalysisProps {
    deepfakeResult: DetectDeepfakeOutput;
    sourceResult?: VerifySourceOutput;
}

export function UnifiedDeepfakeAnalysis({ deepfakeResult, sourceResult }: UnifiedDeepfakeAnalysisProps) {
    // Calculate adjusted manipulation likelihood based on source credibility
    const calculateAdjustedLikelihood = () => {
        // If we have source verification results, adjust the manipulation likelihood
        if (sourceResult && sourceResult.sourceVerified) {
            // For all credibility sources, adjust the manipulation likelihood
            // High credibility sources reduce the manipulation likelihood
            // Low credibility sources increase the manipulation likelihood
            const credibilityFactor = sourceResult.sourceCredibility / 100;
            // For high credibility: reduce score (multiply by 0.5 to 1.0)
            // For low credibility: increase score (multiply by 1.0 to 1.5)
            const adjustmentFactor = 1.0 - (credibilityFactor - 0.5); // Range: 1.5 (0 credibility) to 0.5 (100 credibility)
            const adjustedScore = Math.max(0, Math.min(100, deepfakeResult.confidenceScore * adjustmentFactor));
            return {
                score: adjustedScore,
                explanation: `Adjusted based on source credibility (${sourceResult.sourceCredibility}/100). `
            };
        }
        return {
            score: deepfakeResult.confidenceScore,
            explanation: ''
        };
    };

    const adjustedResult = calculateAdjustedLikelihood();

    const getSourceCredibilityMessage = () => {
        if (!sourceResult) return null;
        
        if (sourceResult.sourceVerified) {
            if (sourceResult.sourceCredibility > 80) {
                return "Source is highly credible. Lower manipulation likelihood expected.";
            } else if (sourceResult.sourceCredibility > 50) {
                return "Source is moderately credible. Standard scrutiny applies.";
            } else {
                return "Source has low credibility. Higher manipulation likelihood expected.";
            }
        }
        return "Source could not be verified.";
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h3 className="font-semibold text-lg">Manipulation Likelihood</h3>
                <Progress value={adjustedResult.score} indicatorClassName={getScoreColorClass(adjustedResult.score, 'confidence')} />
                <p className="text-sm text-muted-foreground">
                    {adjustedResult.explanation}
                    Our analysis indicates a {Math.round(adjustedResult.score)}% likelihood that this media has been manipulated or is a deepfake.
                </p>
            </div>
            
            {sourceResult && (
                <div className="space-y-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <BadgeCheck className="h-5 w-5 text-primary" /> Source Verification Impact
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-secondary/50 p-4 rounded-lg">
                            <p className="text-sm text-muted-foreground">Source Credibility</p>
                            <p className="font-bold text-lg">{sourceResult.sourceCredibility}/100</p>
                        </div>
                        
                        <div className="bg-secondary/50 p-4 rounded-lg">
                            <p className="text-sm text-muted-foreground">Impact on Analysis</p>
                            <p className="font-bold text-lg">
                                {sourceResult.sourceCredibility > 70 ? 'Reduced' : 
                                 sourceResult.sourceCredibility > 40 ? 'Neutral' : 'Increased'}
                            </p>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {getSourceCredibilityMessage()}
                    </p>
                </div>
            )}

            <div className="space-y-2">
                <h3 className="font-semibold text-lg">Verdict</h3>
                <p className={`font-bold text-xl ${getScoreTextColorClass(adjustedResult.score, 'confidence')}`}>
                    {adjustedResult.score > 75 ? "Likely Manipulated / Deepfake" : 
                     adjustedResult.score > 40 ? "Possibly Manipulated" : "Likely Authentic"}
                </p>
            </div>
            
            <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" /> Detailed Analysis
                </h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{deepfakeResult.analysis}</p>
            </div>
            
            {sourceResult && (
                <div className="space-y-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" /> Source Verification Details
                    </h3>
                    <p className="text-muted-foreground">{sourceResult.verificationDetails}</p>
                </div>
            )}
        </div>
    );
}