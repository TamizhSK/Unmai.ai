
// Imports the Google Cloud client library  
import { v2 } from '@google-cloud/translate';
import { config } from 'dotenv';
import { getAuthConfig, getProjectId } from '../auth.js';

// Load environment variables
config();

// Create translate client with modern authentication
function getTranslateClient() {
  return new v2.Translate(getAuthConfig());
}

// API validation removed - runs silently

export const translateTextFlow = async (input: { text: string; targetLanguage: string }): Promise<string> => {
  const { text, targetLanguage } = input;

  if (!text) {
    return '';
  }

  try {
    const translate = getTranslateClient();
    // Translates the input text with error handling
    const [translation] = await translate.translate(text, targetLanguage);
    return translation || text; // Fallback to original text if translation fails
  } catch (error) {
    console.error('[ERROR] Translation failed:', error);
    // Return original text as fallback instead of throwing
    return text;
  }
};

export const detectLanguageFlow = async (text: string): Promise<{ language: string; confidence: number }> => {
  if (!text) {
    return { language: 'unknown', confidence: 0 };
  }
  
  try {
    const translate = getTranslateClient();
    const [detections] = await translate.detect(text);
    const detection = Array.isArray(detections) ? detections[0] : detections;

    if (!detection || typeof detection !== 'object' || !('language' in detection) || !('confidence' in detection)) {
      console.warn('[WARN] Language detection returned invalid response');
      return { language: 'en', confidence: 0.5 }; // Default to English
    }

    return {
      language: detection.language,
      confidence: detection.confidence,
    };
  } catch (error) {
    console.error('[ERROR] Language detection failed:', error);
    return { language: 'en', confidence: 0.5 }; // Fallback to English
  }
};
