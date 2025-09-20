import { UnifiedResponseCard, UnifiedResponseData, TrustScoreBreakdown, EducationalCard } from './unified-response-card';

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
  const safeSources = (sources: any[]): Array<{url: string, title: string}> => {
    if (!Array.isArray(sources)) return [];

    return sources.map((source, index) => {
      if (typeof source === 'string') {
        return { url: source, title: source };
      }
      if (typeof source === 'object' && source !== null) {
        return {
          url: (source.url || source.source || `source-${index}`),
          title: (typeof source.title !== 'undefined' ? (typeof source.title === 'string' ? source.title : JSON.stringify(source.title))
                 : typeof source.snippet !== 'undefined' ? (typeof source.snippet === 'string' ? source.snippet : JSON.stringify(source.snippet))
                 : JSON.stringify(source))
        };
      }
      return { url: String(source), title: String(source) };
    });
  };

  // Helper function to calculate trust score breakdown
  const calculateTrustScoreBreakdown = (task: string, result: any): TrustScoreBreakdown => {
    let sourceCredibility = 50;
    let factCheckMatch = 50;
    let semanticSimilarity = 50;
    let languageCues = 50;

    // Calculate based on task type and result
    switch (task) {
      case 'fact-check':
        factCheckMatch = result.verdict === 'True' ? 95 : result.verdict === 'False' ? 5 : result.verdict === 'Misleading' ? 30 : 50;
        sourceCredibility = result.evidence?.length > 0 ? 80 : 40;
        languageCues = result.explanation?.includes('reliable') ? 85 : 60;
        break;
      case 'url-analysis':
        sourceCredibility = result.verifySource?.credibilityScore || 50;
        factCheckMatch = result.safeSearch?.safetyVerdict === 'SAFE' ? 90 : 20;
        break;
      case 'web-analysis':
        sourceCredibility = result.currentInformation?.length > 0 ? 75 : 40;
        factCheckMatch = result.realTimeFactCheck ? 80 : 50;
        break;
      default:
        // Use result score if available
        const baseScore = result.score || result.trustScore || 50;
        sourceCredibility = Math.min(100, baseScore + 10);
        factCheckMatch = baseScore;
        semanticSimilarity = Math.max(0, baseScore - 10);
        languageCues = baseScore;
    }

    // Calculate weighted overall score
    const overall = Math.round(
      (sourceCredibility * 0.30) + 
      (factCheckMatch * 0.35) + 
      (semanticSimilarity * 0.20) + 
      (languageCues * 0.15)
    );

    return {
      sourceCredibility: Math.max(0, Math.min(100, sourceCredibility)),
      factCheckMatch: Math.max(0, Math.min(100, factCheckMatch)),
      semanticSimilarity: Math.max(0, Math.min(100, semanticSimilarity)),
      languageCues: Math.max(0, Math.min(100, languageCues)),
      overall: Math.max(0, Math.min(100, overall))
    };
  };

  // Helper function to generate educational cards
  const generateEducationalCards = (task: string, result: any): EducationalCard[] => {
    const cards: EducationalCard[] = [];

    // Always add verification guidance
    cards.push({
      type: 'verification',
      title: 'How to Verify This Content',
      content: task === 'fact-check' ? 'Cross-reference claims with multiple reliable sources, check publication dates, and look for expert opinions.' :
               task === 'url-analysis' ? 'Check the domain reputation, look for HTTPS, verify contact information, and read the "About" page.' :
               task === 'deepfake' ? 'Look for unnatural facial movements, inconsistent lighting, and audio-visual synchronization issues.' :
               'Verify information through multiple independent sources and check for recent updates.',
      icon: '🔍'
    });

    // Add manipulation technique warnings based on results
    if (task === 'deepfake' && result.isDeepfake) {
      cards.push({
        type: 'manipulation',
        title: 'Deepfake Detection',
        content: 'This content shows signs of AI manipulation. Look for facial inconsistencies, unnatural eye movements, and audio mismatches.',
        icon: '⚠️'
      });
    }

    if (task === 'fact-check' && (result.verdict === 'False' || result.verdict === 'Misleading')) {
      cards.push({
        type: 'warning',
        title: 'Misinformation Detected',
        content: 'This claim contains false or misleading information. Always verify facts with authoritative sources before sharing.',
        icon: '🚨'
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

  // Default structure
  const unifiedResponse: UnifiedResponseData = {
    mainLabel: 'Analysis',
    oneLineDescription: 'Here is the result of the analysis.',
    informationSummary: {},
    educationalInsight: 'No specific educational insight provided.',
    trustScore: 50,
    sources: [],
    sourceDetails: sourceResult,
    verificationLevel: 'suspicious',
  };

  switch (task) {
    case 'url-analysis':
      unifiedResponse.mainLabel = safeString(result.verifySource?.credibilityScore > 70 ? 'Credible Source' : 'Use with Caution');
      unifiedResponse.oneLineDescription = safeString(`Analysis of the URL: ${result.verifySource?.url ?? ''}`);
      unifiedResponse.informationSummary = {
        what: safeString(result.safeSearch?.safetyVerdict) + '. ' + safeString(result.verifySource?.credibilityVerdict),
      };
      unifiedResponse.educationalInsight = safeString(result.verifySource?.explanation) || 'Review the source credibility and safety assessment for more details.';
      unifiedResponse.trustScore = result.verifySource?.credibilityScore || 50;
      unifiedResponse.sources = safeSources(result.verifySource?.sources || []);
      break;

    case 'deepfake':
      unifiedResponse.mainLabel = safeString(result.isDeepfake ? 'Deepfake Detected' : 'Likely Authentic');
      unifiedResponse.oneLineDescription = safeString(`Deepfake analysis result: ${result.confidenceScore}% confidence.`);
      unifiedResponse.informationSummary = {
        what: safeString(result.summary),
      };
      unifiedResponse.educationalInsight = safeString(result.explanation);
      unifiedResponse.trustScore = 100 - result.confidenceScore;
      break;

    case 'synthetic-content':
      unifiedResponse.mainLabel = safeString(result.isSynthetic ? 'Synthetic Content' : 'Likely Original');
      unifiedResponse.oneLineDescription = safeString(`Synthetic content analysis with ${result.confidenceScore}% confidence.`);
      unifiedResponse.informationSummary = {
        what: safeString(result.summary),
      };
      unifiedResponse.educationalInsight = safeString(result.explanation);
      unifiedResponse.trustScore = 100 - result.confidenceScore;
      break;

    case 'fact-check':
      unifiedResponse.mainLabel = safeString(result.verdict);
      unifiedResponse.oneLineDescription = safeString(`Fact check result for the claim: "${result.claim ?? ''}"`);
      unifiedResponse.informationSummary = {
        what: safeString(result.explanation || result.summary),
      };
      unifiedResponse.educationalInsight = safeString(result.explanation);
      unifiedResponse.trustScore = result.score || (result.verdict === 'True' ? 90 : result.verdict === 'False' ? 10 : result.verdict === 'Misleading' ? 40 : 50);
      // Handle evidence array properly - backend returns objects with source, title, snippet
      unifiedResponse.sources = safeSources(result.evidence || []);
      break;

    case 'web-analysis':
      unifiedResponse.mainLabel = safeString("Web Analysis");
      unifiedResponse.oneLineDescription = safeString("Summary of web search results.");
      unifiedResponse.informationSummary = {
        what: safeString(result.analysisSummary || result.summary),
      };
      unifiedResponse.educationalInsight = safeString(result.analysisSummary || "This is a summary of information found on the web and has not been fact-checked.");
      unifiedResponse.trustScore = 75; // Default score for web analysis
      // Handle currentInformation array from backend
      unifiedResponse.sources = safeSources(result.currentInformation || result.sources || []);
      break;

    default:
      // Generic handler for other tasks
      unifiedResponse.mainLabel = safeString(task.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()));
      unifiedResponse.oneLineDescription = safeString(result.summary) || 'Analysis complete.';
      unifiedResponse.informationSummary = {
        what: safeString(result.explanation || result.summary),
      };
      unifiedResponse.trustScore = result.score || 60;
      break;
  }

  // Calculate enhanced features
  const trustScoreBreakdown = calculateTrustScoreBreakdown(task, result);
  const educationalCards = generateEducationalCards(task, result);
  
  // Update trust score with calculated breakdown
  unifiedResponse.trustScore = trustScoreBreakdown.overall;
  unifiedResponse.verificationLevel = getVerificationLevel(trustScoreBreakdown.overall);
  unifiedResponse.trustScoreBreakdown = trustScoreBreakdown;
  unifiedResponse.educationalCards = educationalCards;

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

  const unifiedData = transformToUnifiedResponse(task, result, sourceResult);

  return <UnifiedResponseCard response={unifiedData} />;
}
