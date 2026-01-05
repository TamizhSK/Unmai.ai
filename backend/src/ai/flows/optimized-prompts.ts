// Optimized AI prompts for ultra-fast processing
// Minimal token usage with maximum effectiveness

export const FAST_PROMPTS = {
  // Ultra-fast image analysis (reduced tokens)
  imageUnderstanding: `Analyze image for misinformation. JSON only:
{
  "desc": "brief description",
  "objects": ["key objects"],
  "text": ["visible text"],
  "authentic": 0-100,
  "issues": ["concerns"],
  "checks": ["fact-check topics"]
}`,

  // Ultra-fast video analysis
  videoUnderstanding: `Analyze video for misinformation. JSON only:
{
  "desc": "content description",
  "events": ["key events"],
  "transcript": "brief transcript",
  "authentic": 0-100,
  "issues": ["concerns"]
}`,

  // Ultra-fast text sentiment (minimal)
  textSentiment: `Analyze text sentiment. JSON only:
{
  "sentiment": "POSITIVE|NEGATIVE|NEUTRAL|MIXED",
  "confidence": 0-1,
  "triggers": ["emotional triggers"]
}`,

  // Ultra-fast manipulation detection
  textManipulation: `Detect manipulation techniques. JSON only:
{
  "techniques": ["detected techniques"],
  "risk": "LOW|MEDIUM|HIGH",
  "indicators": ["key indicators"]
}`,

  // Ultra-fast deepfake detection
  deepfakeAnalysis: `Analyze for manipulation. JSON only:
{
  "manipulated": true/false,
  "confidence": 0-1,
  "summary": "brief explanation"
}`,

  // Ultra-fast presentation formatting
  formatPresentation: `Format analysis results. JSON only:
{
  "title": "one-line description",
  "summary": "analysis summary",
  "insight": "educational insight"
}`
};

// Optimized generation configs for speed
export const FAST_CONFIGS = {
  ultraFast: {
    temperature: 0.1,
    maxOutputTokens: 1000,
    topP: 0.8,
    topK: 20
  },
  
  fast: {
    temperature: 0.2,
    maxOutputTokens: 1500,
    topP: 0.9,
    topK: 40
  },
  
  balanced: {
    temperature: 0.3,
    maxOutputTokens: 2000,
    topP: 0.95,
    topK: 60
  }
};