/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineFlow, run } from '@genkit-ai/ai';
import { SpeechClient } from '@google-cloud/speech';
import * as z from 'zod';
import { factCheckClaim } from './fact-check-claim';

const speechClient = new SpeechClient();

const AudioAnalysisOutputSchema = z.object({
    transcription: z.string(),
    factCheck: z.any(),
});

export const analyzeAudioContent = defineFlow(
    {
        name: 'analyzeAudioContent',
        inputSchema: z.string(), // Audio file URI (e.g., gs://bucket-name/audio.wav)
        outputSchema: AudioAnalysisOutputSchema,
    },
    async (audioUri) => {
        const transcription = await run('transcribe-audio', async () => {
            const [operation] = await speechClient.longRunningRecognize({
                audio: { uri: audioUri },
                config: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: 16000,
                    languageCode: 'en-US',
                    model: 'latest_long',
                    enableWordTimeOffsets: true,
                },
            });

            const [response] = await operation.promise();
            return response.results?.map(result => result.alternatives?.[0].transcript).join('\n') || '';
        });

        const factCheckResult = await run('fact-check-transcription', async () => {
            return await factCheckClaim(transcription);
        });

        return {
            transcription,
            factCheck: factCheckResult,
        };
    }
);
