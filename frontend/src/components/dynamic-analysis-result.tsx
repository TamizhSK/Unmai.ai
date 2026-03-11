/**
 * Agent 8 — UI Presentation Agent
 * Maps backend response to the simplified UI card.
 *
 * The new backend returns:
 * { verdict, label, oneLineDescription, explanation, evidenceSummary, insight, sources, scores, claims, metadata }
 *
 * Also supports the old format for backward compatibility:
 * { analysisLabel, oneLineDescription, summary, educationalInsight, sources, scores }
 */

import { UnifiedResponseCard, UnifiedResponseData, AnalysisLoadingSkeleton } from './unified-response-card';

interface DynamicAnalysisResultProps {
  task: string;
  result: any;
}

function transformToUnifiedResponse(result: any): UnifiedResponseData {
  // New agent pipeline format (preferred)
  if (result?.verdict && result?.label) {
    return {
      verdict: result.verdict as UnifiedResponseData['verdict'],
      label: result.label as UnifiedResponseData['label'],
      oneLineDescription: result.oneLineDescription || '',
      explanation: result.explanation || '',
      evidenceSummary: result.evidenceSummary || '',
      insight: result.insight || '',
      sources: (result.sources || []).map((s: any) => ({
        url: s.url || '',
        title: s.title || '',
        domain: s.domain || '',
        credibilityScore: typeof s.credibilityScore === 'number' ? s.credibilityScore : 0.5,
        credibilityTier: s.credibilityTier || undefined,
      })),
      scores: {
        sourceIntegrity: result.scores?.sourceIntegrity ?? result.scores?.sourceIntegrityScore ?? 0,
        contentAuthenticity: result.scores?.contentAuthenticity ?? result.scores?.contentAuthenticityScore ?? 0,
        trustExplainability: result.scores?.trustExplainability ?? result.scores?.trustExplainabilityScore ?? 0,
      },
      claims: (result.claims || []).map((c: any) => ({
        claim: c.claim || '',
        verdict: c.verdict || 'Unverified',
        confidence: typeof c.confidence === 'number' ? c.confidence : 0,
        reasoning: c.reasoning || '',
        keyEvidence: Array.isArray(c.keyEvidence) ? c.keyEvidence : [],
      })),
      metadata: result.metadata ? {
        source: result.metadata.source,
        isManipulated: result.metadata.isManipulated,
        manipulationDetails: result.metadata.manipulationDetails,
      } : undefined,
    };
  }

  // Old backend format (backward compatibility)
  if (result?.analysisLabel) {
    const labelMap: Record<string, UnifiedResponseData['verdict']> = {
      GREEN: 'True', RED: 'False', ORANGE: 'Misleading', YELLOW: 'Unverified',
    };
    return {
      verdict: labelMap[result.analysisLabel] || 'Unverified',
      label: (result.analysisLabel as UnifiedResponseData['label']) || 'YELLOW',
      oneLineDescription: result.oneLineDescription || '',
      explanation: result.summary || result.explanation || '',
      evidenceSummary: result.evidenceSummary || '',
      insight: result.educationalInsight || result.insight || '',
      sources: (result.sources || []).map((s: any) => ({
        url: s.url || '',
        title: s.title || s.url || '',
        domain: (() => { try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
        credibilityScore: typeof s.credibility === 'number' ? s.credibility : 0.5,
      })),
      scores: {
        sourceIntegrity: result.sourceIntegrityScore ?? result.scores?.sourceIntegrity ?? 0,
        contentAuthenticity: result.contentAuthenticityScore ?? result.scores?.contentAuthenticity ?? 0,
        trustExplainability: result.trustExplainabilityScore ?? result.scores?.trustExplainability ?? 0,
      },
      claims: [],
    };
  }

  // Fallback
  return {
    verdict: 'Unverified',
    label: 'YELLOW',
    oneLineDescription: 'Analysis completed.',
    explanation: typeof result === 'string' ? result : 'No detailed explanation available.',
    evidenceSummary: '',
    insight: '',
    sources: [],
    scores: { sourceIntegrity: 0, contentAuthenticity: 0, trustExplainability: 0 },
    claims: [],
  };
}

export function DynamicAnalysisResult({ task: _task, result }: DynamicAnalysisResultProps) {
  // Handle loading skeleton
  if (result && typeof result === 'object' && (result.kind === 'loading' || result.type === 'loading')) {
    const loadingSkeleton: AnalysisLoadingSkeleton = {
      kind: 'loading',
      stage: result.stage || 'Analyzing...',
      expectedChecks: result.expectedChecks || [],
    };
    return <UnifiedResponseCard response={loadingSkeleton} />;
  }

  // No result — don't render (error shown via toast)
  if (!result || typeof result !== 'object') {
    return null;
  }

  const unifiedData = transformToUnifiedResponse(result);
  return <UnifiedResponseCard response={unifiedData} />;
}
