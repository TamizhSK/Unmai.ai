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
import { geminiPro } from '@genkit-ai/googleai';
import { LanguageServiceClient } from '@google-cloud/language';
import * as z from 'zod';
import { factCheckClaim } from './fact-check-claim';
import { performWebAnalysis } from './perform-web-analysis';

const languageClient = new LanguageServiceClient();

const TextAnalysisOutputSchema = z.object({
    factCheck: z.any(),
    webAnalysis: z.any(),
    sentiment: z.any(),
    nlp: z.any(),
    manipulationAnalysis: z.string(),
});

export const analyzeTextContent = defineFlow(
    {
        name: 'analyzeTextContent',
        inputSchema: z.string(),
        outputSchema: TextAnalysisOutputSchema,
    },
    async (text) => {
        const factCheckPromise = run('fact-check-text', async () => factCheckClaim(text));
        const webAnalysisPromise = run('web-analysis-text', async () => performWebAnalysis(text));

        const nlpPromise = run('nlp-analysis', async () => {
            const document = { content: text, type: 'PLAIN_TEXT' as const };
            const [sentiment] = await languageClient.analyzeSentiment({ document });
            const [entities] = await languageClient.analyzeEntities({ document });
            return { sentiment, entities };
        });

        const [factCheckResult, webAnalysisResult, nlpResult] = await Promise.all([
            factCheckPromise,
            webAnalysisPromise,
            nlpPromise,
        ]);

        const manipulationAnalysis = await run('manipulation-analysis', async () => {
            const llmResponse = await generate({
                model: geminiPro,
                prompt: `Analyze the following text for manipulation techniques, considering its sentiment and entities: ${text}`,
            });
            return llmResponse.text();
        });

        return {
            factCheck: factCheckResult,
            webAnalysis: webAnalysisResult,
            sentiment: nlpResult.sentiment,
            nlp: nlpResult.entities,
            manipulationAnalysis,
        };
    }
);
