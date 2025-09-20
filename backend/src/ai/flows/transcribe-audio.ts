
import { protos, v1 } from '@google-cloud/speech';

// Initialize the Google Cloud Speech client
const speechClient = new v1.SpeechClient();

export const transcribeAudioFlow = async (input: { audioData: string }): Promise<string> => {
  const { audioData } = input;

  const audio = {
    content: audioData,
  };

  // Configuration for WEBM OPUS audio (48kHz sample rate)
  const config = {
    encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
    // Don't specify sample rate for WEBM OPUS - let it auto-detect from header
    languageCode: 'en-US',
    enableAutomaticPunctuation: true,
    model: 'latest_long',
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
      return transcription.trim();
    } else {
      throw new Error('No transcription result received');
    }
  } catch (error) {
    console.error('Audio transcription failed:', error);
    throw new Error(`Unable to transcribe audio: ${(error as Error).message}`);
  }
};
