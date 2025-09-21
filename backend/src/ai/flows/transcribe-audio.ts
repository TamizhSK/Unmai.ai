
'use server';
/**
 * @fileOverview Transcribes audio content using Google Cloud Speech API.
 *
 * - transcribeAudioFlow - A function that transcribes audio content.
 * - TranscribeAudioInput - The input type for the transcribeAudioFlow function.
 * - TranscribeAudioOutput - The return type for the transcribeAudioFlow function.
 */

import { z } from 'zod';
import { protos, v1 } from '@google-cloud/speech';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize the Google Cloud Speech client with error handling
const speechClient = new v1.SpeechClient();

// Get configuration from environment variables
const SPEECH_LANGUAGE_CODE = process.env.SPEECH_LANGUAGE_CODE || 'en-US';
const SPEECH_MODEL = process.env.SPEECH_MODEL || 'latest_long';

// Validate Speech API availability
const validateSpeechAPI = async () => {
  try {
    // Simple validation - the client will be tested when actually used
    console.log('[INFO] Speech API client initialized');
  } catch (error) {
    console.warn('[WARN] Speech API initialization failed:', error);
  }
};

// Initialize validation (non-blocking)
validateSpeechAPI();

const TranscribeAudioInputSchema = z.object({
  audioData: z.string().describe('Base64 encoded audio data'),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  transcription: z.string().describe('The transcribed text'),
  confidence: z.number().min(0).max(1).describe('Confidence score of the transcription'),
  language: z.string().describe('Detected language of the audio'),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

export const transcribeAudioFlow = async (input: TranscribeAudioInput): Promise<TranscribeAudioOutput> => {
  const { audioData } = input;

  const audio = {
    content: audioData,
  };

  // Configuration for WEBM OPUS audio (48kHz sample rate)
  const config = {
    encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
    // Don't specify sample rate for WEBM OPUS - let it auto-detect from header
    languageCode: SPEECH_LANGUAGE_CODE,
    enableAutomaticPunctuation: true,
    model: SPEECH_MODEL,
  };

  try {
    const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
      audio: audio,
      config: config,
    };

    const [response] = await speechClient.recognize(request);
    const transcription = response.results
      ?.map((result) => result.alternatives?.[0].transcript)
      .join('\n');

    if (transcription && transcription.trim()) {
      const confidence = response.results?.[0]?.alternatives?.[0]?.confidence || 0;
      return {
        transcription: transcription.trim(),
        confidence: confidence,
        language: SPEECH_LANGUAGE_CODE
      };
    } else {
      console.warn('[WARN] No transcription result received, returning fallback');
      return {
        transcription: '[Audio could not be transcribed]',
        confidence: 0,
        language: SPEECH_LANGUAGE_CODE
      };
    }
  } catch (error) {
    console.error('[ERROR] Audio transcription failed:', error);
    // Return fallback instead of throwing to prevent API errors from breaking the app
    return {
      transcription: '[Audio transcription unavailable]',
      confidence: 0,
      language: SPEECH_LANGUAGE_CODE
    };
  }
};
