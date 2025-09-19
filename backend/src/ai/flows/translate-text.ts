
// Imports the Google Cloud client library
import { Translate } from '@google-cloud/translate/build/src/v2';

// Instantiates a client
const translate = new Translate();

export const translateTextFlow = async (input: { text: string; targetLanguage: string }): Promise<string> => {
  const { text, targetLanguage } = input;

  if (!text) {
    return '';
  }

  // Translates the input text
  const [translation] = await translate.translate(text, targetLanguage);

  return translation;
};

export const detectLanguageFlow = async (text: string): Promise<{ language: string; confidence: number }> => {
  if (!text) {
    throw new Error("Input text cannot be empty.");
  }
  const [detections] = await translate.detect(text);
  const detection = Array.isArray(detections) ? detections[0] : detections;

  if (!detection || typeof detection !== 'object' || !('language' in detection) || !('confidence' in detection)) {
    throw new Error('Could not detect language.');
  }

  return {
    language: detection.language,
    confidence: detection.confidence,
  };
};
