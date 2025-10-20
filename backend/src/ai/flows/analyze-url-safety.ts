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
import { WebRiskServiceClient } from '@google-cloud/web-risk';
import * as z from 'zod';
import { performWebAnalysis } from './perform-web-analysis';
import { verifySource } from './verify-source';

const webRiskClient = new WebRiskServiceClient();

const UrlAnalysisOutputSchema = z.object({
    threats: z.any(),
    sourceVerification: z.any(),
    webAnalysis: z.any(),
});

export const analyzeUrlSafety = defineFlow(
    {
        name: 'analyzeUrlSafety',
        inputSchema: z.string(), // URL
        outputSchema: UrlAnalysisOutputSchema,
    },
    async (url) => {
        const securityCheckPromise = run('webrisk-check', async () => {
            const [response] = await webRiskClient.searchUris({
                uri: url,
                threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
            });
            return response.threat;
        });

        const sourceVerificationPromise = run('verify-url-source', async () => verifySource(url));
        const webAnalysisPromise = run('web-analysis-url', async () => performWebAnalysis(url));

        const [threats, sourceVerification, webAnalysis] = await Promise.all([
            securityCheckPromise,
            sourceVerificationPromise,
            webAnalysisPromise,
        ]);

        return {
            threats,
            sourceVerification,
            webAnalysis,
        };
    }
);
