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
import { geminiProVision } from '@genkit-ai/googleai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import * as z from 'zod';

const visionClient = new ImageAnnotatorClient();

const ImageAnalysisOutputSchema = z.object({
  analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']),
  contentAuthenticityScore: z.number(),
  geminiAnalysis: z.string(),
  ocr: z.string().optional(),
  labels: z.array(z.string()).optional(),
  safeSearch: z.any().optional(),
  webDetection: z.any().optional(),
});

export const analyzeImageContent = defineFlow(
  {
    name: 'analyzeImageContent',
    inputSchema: z.string(), // Image URL
    outputSchema: ImageAnalysisOutputSchema,
  },
  async (imageUrl: string) => {
    const image = { source: { imageUri: imageUrl } };

    const geminiVisionPromise = run('gemini-vision-analysis', async () => {
      const llmResponse = await generate({
        model: geminiProVision,
        prompt: {
          text: 'Analyze this image for authenticity. Provide a score from 0-100 and a brief explanation.',
          media: [{ url: imageUrl }],
        },
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

    const cloudVisionPromise = run('cloud-vision-analysis', async () => {
      const [textDetection, labelDetection, safeSearchDetection, webDetection] =
        await Promise.all([
          visionClient.textDetection(image),
          visionClient.labelDetection(image),
          visionClient.safeSearchDetection(image),
          visionClient.webDetection(image),
        ]);
      return {
        ocr: textDetection[0].fullTextAnnotation?.text,
        labels: labelDetection[0].labelAnnotations?.map((l) => l.description || ''),
        safeSearch: safeSearchDetection[0].safeSearchAnnotation,
        webDetection: webDetection[0].webDetection,
      };
    });

    const [geminiResult, visionResult] = await Promise.all([
      geminiVisionPromise,
      cloudVisionPromise,
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
      geminiAnalysis: geminiResult.geminiAnalysis,
      ...visionResult,
    };
  }
);
