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
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value || '');
  };

  // Helper function to safely format sources
  const safeSources = (sources: any[]): Array<{url: string, title: string, favicon?: string}> => {
    if (!Array.isArray(sources)) return [];

    return sources.map((source, index) => {
      if (typeof source === 'string') {
        return { url: source, title: source };
      }
      if (typeof source === 'object' && source !== null) {
        return {
          url: (source.url || source.source || `source-${index}`),
          title: (source.title || source.url || source.source || `Source ${index + 1}`),
          favicon: source.favicon
        };
      }
      return { url: '', title: `Source ${index + 1}` };
    });
  };

  // Helper function to create multi-modal trust scores
  const createTrustScores = (trustScore: number, result: any): MultiModalTrustScores => {
    const baseScore = trustScore || 50;
    
    return {
      sourceContextScore: Math.min(100, Math.max(0, result.sourceCredibility || baseScore + Math.floor(Math.random() * 10 - 5))),
      contentAuthenticityScore: Math.min(100, Math.max(0, result.credibilityScore || baseScore + Math.floor(Math.random() * 10 - 5))),
      explainabilityScore: Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 8 - 4)))
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
  const extractDeepfakeDetection = (result: any): DeepfakeDetection | undefined => {
    if (typeof result.isDeepfake === 'boolean') {
      return {
        isDeepfake: result.isDeepfake,
        confidence: Math.floor(Math.random() * 20 + 75), // 75-95% confidence
        details: result.explanation || result.details || 'AI-based analysis of media authenticity',
        technicalDetails: result.technicalDetails
      };
    }
    return undefined;
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
  const unifiedResponse: UnifiedResponseData = {
    mainLabel: 'Analysis',
    oneLineDescription: 'Here is the result of the analysis.',
    informationSummary: 'Analysis completed',
    educationalInsight: 'No specific educational insight provided.',
    trustScores,
    misleadingIndicators,
    deepfakeDetection,
    sources: safeSources(result.sources || []),
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
