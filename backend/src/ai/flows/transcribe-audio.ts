
import { protos, v1 } from '@google-cloud/speech';

// Initialize the Google Cloud Speech client
const speechClient = new v1.SpeechClient();

export const transcribeAudioFlow = async (input: { audioData: string }): Promise<string> => {
  const { audioData } = input;

  const audio = {
    content: audioData,
  };

  // Configure the request
  // This configuration is for a general use case.
  // For better accuracy, you might need to specify the encoding, sampleRateHertz, and languageCode
  // based on the audio format you capture on the frontend.
  const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
    encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.WEBM_OPUS, // Common format for web-based recording. Adjust if needed.
    sampleRateHertz: 48000, // Common sample rate for web audio. Adjust if needed.
    languageCode: 'en-US', // BCP-47 language code, e.g., 'en-US', 'hi-IN'
    // You can enhance this to automatically detect the language or pass it as an input.
  };

  const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
    audio: audio,
    config: config,
  };

  // Detects speech in the audio file
  const [response] = await speechClient.recognize(request);
  const transcription = response.results
    ?.map((result) => result.alternatives?.[0].transcript)
    .join('\n');

  if (!transcription) {
    throw new Error('Unable to transcribe audio.');
  }

  return transcription;
};
