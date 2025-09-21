
// Imports the Google Cloud client library  
import { v2 } from '@google-cloud/translate';
import { config } from 'dotenv';

// Load environment variables
config();

// Instantiates a client with proper error handling
const translate = new v2.Translate();

// Validate API availability
const validateTranslateAPI = async () => {
  try {
    // Test connection with a simple detection
    await translate.detect('test');
    console.log('[INFO] Translation API connection validated');
  } catch (error) {
    console.warn('[WARN] Translation API validation failed:', error);
  }
};

// Initialize validation (non-blocking)
validateTranslateAPI();

export const translateTextFlow = async (input: { text: string; targetLanguage: string }): Promise<string> => {
  const { text, targetLanguage } = input;

  if (!text) {
    return '';
  }

  try {
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
