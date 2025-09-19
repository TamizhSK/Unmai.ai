// API client for calling backend functions through Express server

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface FactCheckClaimInput {
  claim: string;
}

export interface FactCheckClaimOutput {
  verdict: 'True' | 'False' | 'Misleading' | 'Uncertain';
  evidence: Array<{
    source: string;
    title: string;
    snippet: string;
  }>;
  explanation: string;
}

export interface GetCredibilityScoreInput {
  text: string;
}

export interface GetCredibilityScoreOutput {
  score: number;
  explanation: string;
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }>;
}

export interface DetectDeepfakeInput {
  media: string;
  contentType: 'image' | 'video';
  sourceCredibility?: number;
}

export interface DetectDeepfakeOutput {
  isDeepfake: boolean;
  confidence: number;
  explanation: string;
  indicators: Array<{
    indicator: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

export interface ProvideEducationalInsightsInput {
  text: string;
}

export interface ProvideEducationalInsightsOutput {
  insights: Array<{
    topic: string;
    explanation: string;
    sources: string[];
  }>;
  keyConcepts: string[];
  recommendations: string[];
}

export interface AssessSafetyInput {
  content: string;
  contentType: 'text' | 'url' | 'image';
}

export interface AssessSafetyOutput {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  categories: Array<{
    category: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  recommendations: string[];
}

export interface VerifySourceInput {
  content: string;
  contentType: 'text' | 'url' | 'image';
}

export interface VerifySourceOutput {
  sourceCredibility: number;
  sourceType: string;
  verificationStatus: 'verified' | 'unverified' | 'suspicious';
  details: {
    domain: string;
    reputation: string;
    lastUpdated: string;
  };
}

export interface PerformWebAnalysisInput {
  query: string;
  contentType: 'text' | 'url';
}

export interface PerformWebAnalysisOutput {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    relevance: number;
  }>;
  summary: string;
  trends: string[];
}

export interface DetectSyntheticContentInput {
  media: string;
  contentType: 'image' | 'video';
}

export interface DetectSyntheticContentOutput {
  isSynthetic: boolean;
  confidence: number;
  explanation: string;
  indicators: Array<{
    indicator: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

export interface AnalyzeContentForMisinformationInput {
  content: string;
}

export interface AnalyzeContentForMisinformationOutput {
  isMisinformation: boolean;
  confidence: number;
  explanation: string;
  indicators: Array<{
    indicator: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

export interface SafeSearchUrlInput {
  url: string;
}

export interface SafeSearchUrlOutput {
  isSafe: boolean;
  threats: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  recommendations: string[];
}

export interface TranscribeAudioInput {
  audioData: string;
}

export type TranscribeAudioOutput = string;

export interface ExplainMisleadingIndicatorsInput {
  content: string;
}

export interface ExplainMisleadingIndicatorsOutput {
  explanation: string;
}

// API Client functions
export async function factCheckClaim(input: FactCheckClaimInput): Promise<FactCheckClaimOutput> {
  const response = await fetch(`${API_BASE_URL}/api/fact-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Fact check failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function getCredibilityScore(input: GetCredibilityScoreInput): Promise<GetCredibilityScoreOutput> {
  const response = await fetch(`${API_BASE_URL}/api/credibility-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Credibility score failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function detectDeepfake(input: DetectDeepfakeInput): Promise<DetectDeepfakeOutput> {
  const response = await fetch(`${API_BASE_URL}/api/detect-deepfake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Deepfake detection failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function provideEducationalInsights(input: ProvideEducationalInsightsInput): Promise<ProvideEducationalInsightsOutput> {
  const response = await fetch(`${API_BASE_URL}/api/educational-insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Educational insights failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function assessSafety(input: AssessSafetyInput): Promise<AssessSafetyOutput> {
  const response = await fetch(`${API_BASE_URL}/api/safety-assessment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Safety assessment failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function verifySource(input: VerifySourceInput): Promise<VerifySourceOutput> {
  const response = await fetch(`${API_BASE_URL}/api/verify-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Source verification failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function performWebAnalysis(input: PerformWebAnalysisInput): Promise<PerformWebAnalysisOutput> {
  const response = await fetch(`${API_BASE_URL}/api/web-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Web analysis failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function detectSyntheticContent(input: DetectSyntheticContentInput): Promise<DetectSyntheticContentOutput> {
  const response = await fetch(`${API_BASE_URL}/api/detect-synthetic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Synthetic content detection failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function analyzeContentForMisinformation(input: AnalyzeContentForMisinformationInput): Promise<AnalyzeContentForMisinformationOutput> {
  const response = await fetch(`${API_BASE_URL}/api/analyze-misinformation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Misinformation analysis failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function safeSearchUrl(input: SafeSearchUrlInput): Promise<SafeSearchUrlOutput> {
  const response = await fetch(`${API_BASE_URL}/api/safe-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Safe search failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function transcribeAudioFlow(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  const response = await fetch(`${API_BASE_URL}/api/transcribe-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Audio transcription failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function explainMisleadingIndicators(input: ExplainMisleadingIndicatorsInput): Promise<ExplainMisleadingIndicatorsOutput> {
  const response = await fetch(`${API_BASE_URL}/api/explain-indicators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error(`Explain indicators failed: ${response.statusText}`);
  }
  
  return response.json();
}
