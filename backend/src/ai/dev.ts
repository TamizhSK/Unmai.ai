import { config } from 'dotenv';
config();

// Import all flows to register them with Genkit
import './flows/fact-check-claim.ts';
import './flows/get-credibility-score.ts';
import './flows/detect-deepfake.ts';
import './flows/verify-source.ts';
import './flows/perform-web-analysis.ts';
import './flows/detect-synthetic-content.ts';
import './flows/analyze-content-for-misinformation.ts';
import './flows/safe-search-url.ts';
import './flows/safety-assessment.ts';
import './flows/provide-educational-insights.ts';
import './flows/explain-misleading-indicators.ts';
import './flows/transcribe-audio.ts';
import './flows/translate-text.ts';
