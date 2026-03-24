/**
 * Google Cloud Translation Service
 * 
 * Provides text translation and language detection.
 * 
 * Usage:
 *   const translatedText = await translationService.translateText('Hola mundo', 'en');
 */

import { TranslationServiceClient } from '@google-cloud/translate';
import { getAuthConfig, getProjectId } from '../ai/auth.js';

class TranslationService {
  private static instance: TranslationService;
  private client: TranslationServiceClient;
  private projectId: string;

  private constructor() {
    this.client = new TranslationServiceClient(getAuthConfig());
    this.projectId = getProjectId();
  }

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  /**
   * Translate text to a target language
   * 
   * @param text - The text to translate
   * @param targetLanguage - ISO 639-1 language code (e.g., 'en')
   * @returns Translated text
   */
  async translateText(text: string, targetLanguage: string = 'en'): Promise<string> {
    if (!text || text.trim().length === 0) {
      return '';
    }

    try {
      const request = {
        parent: `projects/${this.projectId}/locations/global`,
        contents: [text],
        mimeType: 'text/plain',
        targetLanguageCode: targetLanguage,
      };

      const [response] = await this.client.translateText(request);
      
      if (response.translations && response.translations.length > 0) {
        return response.translations[0].translatedText || text;
      }
      
      return text;
    } catch (error) {
      console.error('[Translation] Error translating text:', error);
      return text; // Fallback to original text
    }
  }

  /**
   * Detect the language of a text
   * 
   * @param text - The text to detect
   * @returns ISO 639-1 language code
   */
  async detectLanguage(text: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      return 'en';
    }

    try {
      const request = {
        parent: `projects/${this.projectId}/locations/global`,
        content: text,
        mimeType: 'text/plain',
      };

      const [response] = await this.client.detectLanguage(request);
      
      if (response.languages && response.languages.length > 0) {
        return response.languages[0].languageCode || 'en';
      }
      
      return 'en';
    } catch (error) {
      console.error('[Translation] Error detecting language:', error);
      return 'en';
    }
  }
}

export const translationService = TranslationService.getInstance();
export default translationService;
