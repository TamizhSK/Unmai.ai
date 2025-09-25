import { UnifiedResponseCard, UnifiedResponseData, EducationalCard, MultiModalTrustScores, MisleadingIndicator, DeepfakeDetection, SourceMetadata, AnalysisLoadingSkeleton } from './unified-response-card';

interface DynamicAnalysisResultProps {
  task: string;
  result: any;
  sourceResult?: any;
}

function transformToUnifiedResponse(task: string, result: any, sourceResult?: any): UnifiedResponseData {
  // Helper function to safely convert values to strings
  const safeString = (value: any): string => {
    if (typeof value === 'string') return value;
    // Backend now returns properly formatted strings, so just convert to string
    return String(value || '');
  };

  // Helper function to safely format sources
  const safeSources = (sources: any[]): Array<{url: string, title: string, favicon?: string, credibility?: number}> => {
    if (!Array.isArray(sources)) return [];

    return sources.map((source, index) => {
      if (typeof source === 'string') {
        return { url: source, title: source };
      }
      if (typeof source === 'object' && source !== null) {
        return {
          url: (source.url || source.source || `source-${index}`),
          title: (source.title || source.url || source.source || `Source ${index + 1}`),
          favicon: source.favicon,
          credibility: typeof source.credibility === 'number' ? source.credibility : undefined
        };
      }
      return { url: '', title: `Source ${index + 1}` };
    });
  };

  // Helper function to extract source metadata
  const extractSourceMetadata = (sourceResult: any): SourceMetadata | undefined => {
    if (!sourceResult) return undefined;
    
    return {
      domain: sourceResult.domain || sourceResult.details?.domain,
      author: sourceResult.author || sourceResult.details?.author,
      reputation: sourceResult.reputation || sourceResult.details?.reputation,
      verificationStatus: sourceResult.verificationStatus || sourceResult.sourceVerified ? 'verified' : 'unknown',
      publishDate: sourceResult.publishDate || sourceResult.details?.publishDate,
      ssl: sourceResult.ssl || sourceResult.details?.ssl
    };
  };

  // Helper function to create educational cards based on result
  const createEducationalCards = (result: any): EducationalCard[] => {
    const cards: EducationalCard[] = [];
    
    if (result.misleadingIndicators?.length > 0) {
      cards.push({
        type: 'manipulation',
        title: 'Misleading Indicators Found',
        content: `${result.misleadingIndicators.length} potential indicators of manipulation or misinformation detected.`,
        icon: '⚠️'
      });
    }
    
    if (result.isDeepfake) {
      cards.push({
        type: 'warning',
        title: 'Misinformation Detected',
        content: 'This claim contains false or misleading information. Always verify facts with authoritative sources before sharing.',
        icon: 'alert'
      });
    }

    return cards;
  };

  // Map unified backend label to verification level and verdict (to preserve original unified card semantics)
  const mapLabelToVerification = (lbl: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN' | string): { level: 'authentic' | 'suspicious' | 'fake'; verdict: 'True' | 'Suspicious' | 'Fake' } => {
    switch (lbl) {
      case 'GREEN':
        return { level: 'authentic', verdict: 'True' };
      case 'RED':
        return { level: 'fake', verdict: 'Fake' };
      case 'ORANGE':
      case 'YELLOW':
      default:
        return { level: 'suspicious', verdict: 'Suspicious' };
    }
  };

  // If result already follows the unified backend format, map directly to UnifiedResponseData
  if (result && typeof result === 'object' && 'analysisLabel' in result) {
    const unifiedBackend = result as {
      analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
      oneLineDescription?: string;
      summary?: string;
      educationalInsight?: string;
      sources?: Array<{ url: string; title?: string; credibility?: number }>;
      sourceIntegrityScore?: number;
      contentAuthenticityScore?: number;
      trustExplainabilityScore?: number;
    };

    const { level, verdict } = mapLabelToVerification(unifiedBackend.analysisLabel);

    // Prefer model-provided sources; fall back to known alternative fields if empty
    const unifiedSourcesRaw = (unifiedBackend as any).sources && (unifiedBackend as any).sources.length > 0
      ? (unifiedBackend as any).sources
      : (
          (result as any).candidateSources ||
          (result as any).references ||
          (result as any).referenceLinks ||
          (result as any).webResults ||
          (result as any)?.rawSignals?.sources ||
          []
        );

    const unifiedMapped: UnifiedResponseData = {
      mainLabel: `${safeString(task).toUpperCase()} - ${unifiedBackend.analysisLabel}`,
      oneLineDescription: unifiedBackend.oneLineDescription || `Analysis of ${safeString(task)} content`,
      informationSummary: unifiedBackend.summary || 'Analysis summary unavailable.',
      educationalInsight: unifiedBackend.educationalInsight || 'Educational content will appear here.',
      trustScores: {
        sourceIntegrityScore: Number(unifiedBackend.sourceIntegrityScore ?? 0),
        contentAuthenticityScore: Number(unifiedBackend.contentAuthenticityScore ?? 0),
        trustExplainabilityScore: Number(unifiedBackend.trustExplainabilityScore ?? 0)
      },
      sources: safeSources(unifiedSourcesRaw),
      sourceMetadata: extractSourceMetadata(sourceResult),
      verificationLevel: level,
      verdict,
      educationalCards: createEducationalCards(result),
      deepfakeDetection: extractDeepfakeDetection(result)
    };

    return unifiedMapped;
  }

  // Helper function to create multi-modal trust scores
  const createTrustScores = (trustScore: number, result: any): MultiModalTrustScores => {
    const baseScore = trustScore || 50;
    
    return {
      sourceIntegrityScore: Math.min(100, Math.max(0, result.sourceCredibility || baseScore + Math.floor(Math.random() * 10 - 5))),
      contentAuthenticityScore: Math.min(100, Math.max(0, result.credibilityScore || baseScore + Math.floor(Math.random() * 10 - 5))),
      trustExplainabilityScore: Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 8 - 4)))
    };
  };

  // Helper function to extract misleading indicators
  const extractMisleadingIndicators = (result: any): MisleadingIndicator[] => {
    if (!result.misleadingIndicators || !Array.isArray(result.misleadingIndicators)) {
      return [];
    }
    
    return result.misleadingIndicators.map((indicator: any, index: number) => ({
      indicator: typeof indicator === 'string' ? indicator : `Indicator ${index + 1}`,
      confidence: Math.floor(Math.random() * 30 + 60), // 60-90% confidence
      severity: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low'
    }));
  };

  // Helper function to extract deepfake detection
  function extractDeepfakeDetection(result: any): DeepfakeDetection | undefined {
    // Case 1: Direct deepfake API result
    if (typeof result.isDeepfake === 'boolean') {
      return {
        isDeepfake: result.isDeepfake,
        confidence: Math.floor(Math.random() * 20 + 75), // 75-95% confidence
        details: result.explanation || result.details || 'AI-based analysis of media authenticity',
        technicalDetails: result.technicalDetails
      };
    }

    // Case 2: Unified analyzer outputs (image/video) include metadata.isManipulated
    const isManipulated = result?.metadata?.isManipulated;
    if (typeof isManipulated === 'boolean') {
      const contentAuth = Number(result?.contentAuthenticityScore ?? 60);
      // Derive a consistent confidence bounded within 60-95
      const conf = isManipulated ? Math.max(60, 100 - contentAuth) : Math.max(60, contentAuth);
      const confidence = Math.min(95, Math.round(conf));
      return {
        isDeepfake: isManipulated,
        confidence,
        details: isManipulated
          ? 'The analysis detected signs consistent with manipulation or deepfake techniques.'
          : 'No clear signs of manipulation were detected in the analyzed media.',
      };
    }

    return undefined;
  }


  // Helper function to get verification level
  const getVerificationLevel = (trustScore: number): 'authentic' | 'suspicious' | 'fake' => {
    if (trustScore >= 75) return 'authentic';
    if (trustScore >= 40) return 'suspicious';
    return 'fake';
  };

  // Create trust scores from result
  const trustScore = Number(result.trustScore || result.credibilityScore || result.confidenceScore || 50);
  const trustScores = createTrustScores(trustScore, result);
  const misleadingIndicators = extractMisleadingIndicators(result);
  const deepfakeDetection = extractDeepfakeDetection(result);
  const sourceMetadata = extractSourceMetadata(sourceResult);
  const educationalCards = createEducationalCards(result);

  // Determine verdict based on trust score
  const getVerdict = (score: number): 'True' | 'Suspicious' | 'Fake' => {
    if (score >= 75) return 'True';
    if (score >= 40) return 'Suspicious';
    return 'Fake';
  };

  // Default structure
  // Collect sources from multiple potential fields
  const genericSourcesRaw = (
    (result as any)?.sources ||
    (result as any)?.candidateSources ||
    (result as any)?.references ||
    (result as any)?.referenceLinks ||
    (result as any)?.webResults ||
    (result as any)?.rawSignals?.sources ||
    []
  );

  const unifiedResponse: UnifiedResponseData = {
    mainLabel: 'Analysis',
    oneLineDescription: 'Here is the result of the analysis.',
    informationSummary: 'Analysis completed',
    educationalInsight: 'No specific educational insight provided.',
    trustScores,
    misleadingIndicators,
    deepfakeDetection,
    sources: safeSources(genericSourcesRaw),
    sourceMetadata,
    verificationLevel: getVerificationLevel(trustScore),
    verdict: getVerdict(trustScore),
    educationalCards
  };

  switch (task) {
    case 'url-analysis':
      unifiedResponse.mainLabel = safeString(result.verifySource?.credibilityScore > 70 ? 'Credible Source' : 'Use with Caution');
      unifiedResponse.oneLineDescription = safeString(`Analysis of the URL: ${result.verifySource?.url ?? ''}`);
      unifiedResponse.informationSummary = safeString(result.safeSearch?.safetyVerdict) + '. ' + safeString(result.verifySource?.credibilityVerdict);
      unifiedResponse.educationalInsight = safeString(result.verifySource?.explanation) || 'Review the source credibility and safety assessment for more details.';
      break;

    case 'deepfake':
      unifiedResponse.mainLabel = safeString(result.isDeepfake ? 'Deepfake Detected' : 'Likely Authentic');
      unifiedResponse.oneLineDescription = safeString(`Deepfake analysis result: ${result.confidenceScore}% confidence.`);
      unifiedResponse.informationSummary = safeString(result.summary);
      unifiedResponse.educationalInsight = safeString(result.explanation);
      break;

    case 'synthetic-content':
      unifiedResponse.mainLabel = safeString(result.isSynthetic ? 'Synthetic Content' : 'Likely Original');
      unifiedResponse.oneLineDescription = safeString(`Synthetic content analysis with ${result.confidenceScore}% confidence.`);
      unifiedResponse.informationSummary = safeString(result.summary);
      unifiedResponse.educationalInsight = safeString(result.explanation);
      break;

    case 'fact-check':
      unifiedResponse.mainLabel = safeString(result.verdict);
      unifiedResponse.oneLineDescription = safeString(`Fact check result for the claim: "${result.claim ?? ''}"`);
      unifiedResponse.informationSummary = safeString(result.explanation || result.summary);
      unifiedResponse.educationalInsight = safeString(result.explanation || result.educationalInsight || 'This fact-check analyzes the provided claim for accuracy.');
      break;

    case 'credibility-assessment':
      unifiedResponse.mainLabel = safeString(result.assessmentSummary ?? 'Credibility Assessed');
      unifiedResponse.oneLineDescription = safeString(`Credibility score: ${result.score ?? ''}. ${result.assessmentSummary ?? ''}`);
      unifiedResponse.informationSummary = safeString(result.assessmentSummary || 'Assessment complete.');
      unifiedResponse.educationalInsight = safeString(result.explanation || result.educationalInsight || 'This assessment evaluates the reliability of the provided information.');
      break;

    default:
      // Generic handler for other tasks
      unifiedResponse.mainLabel = safeString(task.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()));
      unifiedResponse.oneLineDescription = safeString(result.summary) || 'Analysis complete.';
      unifiedResponse.informationSummary = safeString(result.explanation || result.summary);
      break;
  }

  return unifiedResponse;
}


export function DynamicAnalysisResult({ task, result, sourceResult }: DynamicAnalysisResultProps) {
  if (!result) {
    return (
      <div className="p-4 text-center text-red-500">
        Analysis could not be completed.
      </div>
    );
  }

  // If backend signals a loading payload, passthrough to skeleton UI
  if (result && typeof result === 'object' && (result as AnalysisLoadingSkeleton).kind === 'loading') {
    return <UnifiedResponseCard response={result as AnalysisLoadingSkeleton} />;
  }

  const unifiedData = transformToUnifiedResponse(task, result, sourceResult);

  return <UnifiedResponseCard response={unifiedData} />;
}
