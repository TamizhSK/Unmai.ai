'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AnalysisResult {
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  summary: string;
  overallVerdict: string;
  educationalInsight: string;
  sourceIntegrityScore?: number;
  contentAuthenticityScore?: number;
  trustExplainabilityScore?: number;
  sources?: Array<{ url: string; title: string; credibility: number }>;
  claims?: Array<{
    claim: string;
    verdict: string;
    confidence: number;
    explanation?: string;
  }>;
  [key: string]: any;
}

interface MultimodalAnalysisResultProps {
  result: AnalysisResult;
}

const MultimodalAnalysisResult: React.FC<MultimodalAnalysisResultProps> = ({ result }) => {
  const getLabelColor = (label: string) => {
    switch (label) {
      case 'RED': 
        return { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', icon: AlertTriangle };
      case 'YELLOW': 
        return { bg: 'bg-yellow-500', text: 'text-yellow-500', border: 'border-yellow-500', icon: Info };
      case 'ORANGE': 
        return { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', icon: AlertTriangle };
      case 'GREEN': 
        return { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500', icon: CheckCircle };
      default: 
        return { bg: 'bg-gray-500', text: 'text-gray-500', border: 'border-gray-500', icon: Info };
    }
  };

  const labelStyle = getLabelColor(result.analysisLabel);
  const LabelIcon = labelStyle.icon;

  // Calculate scores with defaults
  const scores = {
    sourceIntegrity: result.sourceIntegrityScore ?? 75,
    contentAuthenticity: result.contentAuthenticityScore ?? 80,
    trustExplainability: result.trustExplainabilityScore ?? 70,
  };

  return (
    <Card className="w-full max-w-3xl mx-auto bg-gray-800 text-white border-gray-700">
      <CardContent className="p-6 space-y-6">
        {/* Header with Label */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-full ${labelStyle.bg} text-white flex items-center gap-2`}>
              <LabelIcon className="w-5 h-5" />
              <span className="font-semibold">{result.analysisLabel}</span>
            </div>
          </div>
          
          {/* One-line description */}
          <h3 className="text-xl font-medium text-gray-100">
            {result.summary || 'Analysis complete'}
          </h3>
        </div>

        {/* Information Summary */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Information Summary</h4>
          <p className="text-gray-200 leading-relaxed">
            {result.overallVerdict || 'Content has been analyzed for authenticity and credibility.'}
          </p>
          {result.claims && result.claims.length > 0 && (
            <div className="mt-3 space-y-2">
              {result.claims.slice(0, 3).map((claim, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 ${
                    claim.verdict === 'VERIFIED' ? 'text-green-400' :
                    claim.verdict === 'DISPUTED' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    •
                  </span>
                  <div>
                    <span className="text-gray-300">{claim.claim}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      ({claim.verdict} - {(claim.confidence * 100).toFixed(0)}% confidence)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Educational Insight */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Educational Insight</h4>
          <p className="text-gray-200 leading-relaxed text-sm">
            {result.educationalInsight || 
            'Understanding how misinformation spreads and how to identify it helps protect against manipulation.'}
          </p>
        </div>

        {/* Score Indicators */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-4 text-center">
            <div className="relative w-20 h-20 mx-auto mb-2">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-600"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(scores.sourceIntegrity / 100) * 226} 226`}
                  className="text-blue-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{scores.sourceIntegrity}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">Source Integrity</p>
            <p className="text-xs text-gray-500">score</p>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4 text-center">
            <div className="relative w-20 h-20 mx-auto mb-2">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-600"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(scores.contentAuthenticity / 100) * 226} 226`}
                  className="text-green-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{scores.contentAuthenticity}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">Content Authenticity</p>
            <p className="text-xs text-gray-500">score</p>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4 text-center">
            <div className="relative w-20 h-20 mx-auto mb-2">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-600"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(scores.trustExplainability / 100) * 226} 226`}
                  className="text-purple-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{scores.trustExplainability}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">Trust Explainability</p>
            <p className="text-xs text-gray-500">score</p>
          </div>
        </div>

        {/* Sources Section */}
        {result.sources && result.sources.length > 0 && (
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">Sources</h4>
              <Badge variant="secondary" className="bg-gray-600 text-gray-200">
                {result.sources.length} sources
              </Badge>
            </div>
            <div className="space-y-2">
              {result.sources.slice(0, 5).map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-600/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-200 group-hover:text-white">
                      {source.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {(source.credibility * 100).toFixed(0)}% credible
                    </span>
                    <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-300" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MultimodalAnalysisResult;
