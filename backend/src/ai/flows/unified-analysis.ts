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
import * as z from 'zod';
import { analyzeImageContent } from './analyze-image-content';
import { analyzeTextContent } from './analyze-text-content';
import { analyzeVideoContent } from './analyze-video-content';
import { formatUnifiedPresentation } from './format-unified-presentation';

// Define the input schema for the unified analysis flow
const UnifiedAnalysisInputSchema = z.object({
  type: z.enum(['text', 'image', 'video']),
  content: z.string(),
});

// Define the output schema for the unified analysis flow
const UnifiedAnalysisOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  educationalInsight: z.string(),
});

// Define the unified analysis flow
export const unifiedAnalysis = defineFlow(
  {
    name: 'unifiedAnalysis',
    inputSchema: UnifiedAnalysisInputSchema,
    outputSchema: UnifiedAnalysisOutputSchema,
  },
  async (input) => {
    let analysisResult;

    // Run the appropriate analysis based on the input type
    if (input.type === 'text') {
      analysisResult = await run('text-analysis', async () => await analyzeTextContent(input.content));
    } else if (input.type === 'image') {
      analysisResult = await run('image-analysis', async () => await analyzeImageContent(input.content));
    } else if (input.type === 'video') {
      analysisResult = await run('video-analysis', async () => await analyzeVideoContent(input.content));
    } else {
      throw new Error('Unsupported content type');
    }

    // Format the unified presentation
    const formattedOutput = await run('format-presentation', async () => await formatUnifiedPresentation(analysisResult));

    return formattedOutput;
  }
);
