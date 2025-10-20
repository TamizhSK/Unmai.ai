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

import { defineFlow, generate, run } from '@genkit-ai/ai';
import { geminiPro, geminiProVision } from '@genkit-ai/googleai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { VideoIntelligenceServiceClient } from '@google-cloud/video-intelligence';
import * as z from 'zod';

const videoClient = new VideoIntelligenceServiceClient();
const visionClient = new ImageAnnotatorClient();

const VideoAnalysisOutputSchema = z.object({
    analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']),
    contentAuthenticityScore: z.number(),
    transcription: z.string().optional(),
    events: z.array(z.string()).optional(),
    shotChanges: z.array(z.any()).optional(),
    frameAnalysis: z.any().optional(),
    geminiAnalysis: z.string(),
});

export const analyzeVideoContent = defineFlow(
    {
        name: 'analyzeVideoContent',
        inputSchema: z.string(), // Video URL
        outputSchema: VideoAnalysisOutputSchema,
    },
    async (videoUrl: string) => {
        const videoIntelligencePromise = run('video-intelligence-analysis', async () => {
            const [operation] = await videoClient.annotateVideo({
                inputUri: videoUrl,
                features: ['SPEECH_TRANSCRIPTION', 'LABEL_DETECTION', 'SHOT_CHANGE_DETECTION'],
            });
            const [result] = await operation.promise();

            const transcription = result.annotationResults?.[0]?.speechTranscriptions?.[0]?.alternatives?.[0]?.transcript;
            const events = result.annotationResults?.[0]?.labelAnnotations?.map(a => a.entity?.description || '');
            const shotChanges = result.annotationResults?.[0]?.shotLabelAnnotations;

            return { transcription, events, shotChanges };
        });

        const frameAnalysisPromise = run('video-frame-analysis', async () => {
            // This is a placeholder for a more sophisticated frame selection logic
            // For now, we'll just analyze the first frame
            const visionResponse = await visionClient.annotateImage({
                image: { source: { imageUri: videoUrl } }, // Assuming the video URL can be used as an image for the first frame
                features: [{ type: 'LABEL_DETECTION' }, { type: 'SAFE_SEARCH_DETECTION' }],
            });
            return visionResponse;
        });

        const geminiAnalysisPromise = run('gemini-video-analysis', async () => {
            const llmResponse = await generate({
                model: geminiPro,
                prompt: `Analyze the content of this video based on its transcription and events. Provide a score from 0-100 for its authenticity and a brief explanation. Video URL: ${videoUrl}`,
                output: {
                    schema: z.object({
                        score: z.number().min(0).max(100),
                        explanation: z.string(),
                    }),
                },
            });
            const output = llmResponse.output();
            if (!output) throw new Error('Failed to get output from Gemini');
            return {
                contentAuthenticityScore: output.score,
                geminiAnalysis: output.explanation,
            };
        });

        const [videoIntelligenceResult, frameAnalysisResult, geminiResult] = await Promise.all([
            videoIntelligencePromise,
            frameAnalysisPromise,
            geminiAnalysisPromise,
        ]);

        const contentAuthenticityScore = geminiResult.contentAuthenticityScore;
        let analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN' = 'GREEN';
        if (contentAuthenticityScore < 20) {
            analysisLabel = 'RED';
        } else if (contentAuthenticityScore < 50) {
            analysisLabel = 'ORANGE';
        } else if (contentAuthenticityScore < 80) {
            analysisLabel = 'YELLOW';
        }

        return {
            analysisLabel,
            contentAuthenticityScore,
            ...videoIntelligenceResult,
            frameAnalysis: frameAnalysisResult,
            geminiAnalysis: geminiResult.geminiAnalysis,
        };
    }
);
