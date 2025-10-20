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

import { generate as genkitGenerate, defineFlow } from '@genkit-ai/ai';
import { geminiPro } from '@genkit-ai/googleai';
import * as z from 'zod';

// Input schema for the unified presentation flow
const UnifiedAnalysisInputSchema = z.object({
  analysisLabel: z.string().describe('The overall risk level of the content'),
  sourceIntegrityScore: z.number().describe('The integrity score of the source'),
  contentAuthenticityScore: z.number().describe('The authenticity score of the content'),
  isDeepfake: z.boolean().describe('Whether the content is a deepfake'),
  factCheck: z.string().describe('A summary of the fact-check'),
  sourceVerification: z.string().describe('A summary of the source verification'),
});

// Output schema for the unified presentation flow
const UnifiedAnalysisOutputSchema = z.object({
  title: z.string().describe('A brief, one-line description of the analyzed input'),
  summary: z.string().describe('A concise summary of the key findings'),
  educationalInsight: z.string().describe('An educational insight into how the manipulation is done or how well the information is given'),
});

// Define the flow for formatting the unified presentation
export const formatUnifiedPresentation = defineFlow(
  {
    name: 'formatUnifiedPresentation',
    inputSchema: UnifiedAnalysisInputSchema,
    outputSchema: UnifiedAnalysisOutputSchema,
  },
  async (analysis) => {
    // Create a detailed prompt for the AI model
    const prompt = `
      As an AI expert in media literacy and critical thinking, your task is to synthesize the provided analysis signals into a clear, concise, and educational summary. The output should be in JSON format and include the following fields:
      - title: A brief, one-line description of the analyzed input.
      - summary: A concise summary of the key findings.
      - educationalInsight: An educational insight into how the manipulation is done or how well the information is given.

      Here's the analysis data:
      - Risk Level: ${analysis.analysisLabel}
      - Source Integrity Score: ${analysis.sourceIntegrityScore}/100
      - Content Authenticity Score: ${analysis.contentAuthenticityScore}/100
      - Deepfake: ${analysis.isDeepfake ? 'Yes' : 'No'}
      - Fact-Check: ${analysis.factCheck}
      - Source Verification: ${analysis.sourceVerification}

      Based on this data, please generate the JSON output.
    `;

    // Generate the content using the Gemini Pro model
    const llmResponse = await genkitGenerate({
      model: geminiPro,
      prompt: prompt,
    });

    // Parse the JSON output from the model
    const formattedOutput = JSON.parse(llmResponse.text());

    // Return the structured output
    return formattedOutput;
  }
);
