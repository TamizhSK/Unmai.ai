'use server';
import { z } from 'zod';
import { groundedModel } from '../genkit.js';

const PresentationSchema = z.object({
  oneLineDescription: z.string().min(1),
  summary: z.string().min(1),
  educationalInsight: z.string().min(1),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string().min(1),
    credibility: z.number().min(0).max(1)
  })).min(3).max(8)
});
export type Presentation = z.infer<typeof PresentationSchema>;

function cleanJson(text: string): any {
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(clean);
}

export async function formatUnifiedPresentation(input: {
  contentType: 'text' | 'url' | 'image' | 'video' | 'audio';
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  rawSignals: Record<string, any>; // claims, ocrText, transcription, threats, deepfake, etc.
  candidateSources: Array<{ url: string; title?: string; snippet?: string; relevance?: number }>;
}): Promise<Presentation> {
  const prompt = `You are a professional misinformation analyst.

Task: Convert the analysis signals below into a clean, user-friendly presentation for an end-user card.

CRITICAL:
- Respond ONLY with valid JSON that matches the required schema exactly. No extra commentary or markdown.
- Use the provided candidateSources to select 5-8 legitimate URLs. Prefer candidates with higher relevance and credible domains (.gov, .edu, major news orgs, fact-check sites). If fewer than 5 candidates are suitable, you may include additional authoritative sources you know, but ensure URLs are legitimate and directly relevant.
- Write for end-users in clear, straightforward language. Avoid code blocks and raw JSON. Use concise paragraphs or bullet points where helpful.
- Be detailed and specific. Explain key indicators and evidence, not just conclusions.
- Produce:
  1) oneLineDescription: a succinct, neutral, polished one-liner describing the input and outcome
  2) summary: a detailed, readable summary of findings (no raw JSON; avoid code blocks)
  3) educationalInsight: guidance on manipulation/risk indicators and protection steps
  4) sources: 5-8 entries with url, human-readable title, and credibility (0-1)

Required JSON schema:
{
  "oneLineDescription": string,
  "summary": string,
  "educationalInsight": string,
  "sources": [
    { "url": string, "title": string, "credibility": number }
  ]
}

Context:
contentType: ${input.contentType}
analysisLabel: ${input.analysisLabel}
rawSignals: ${JSON.stringify(input.rawSignals).slice(0, 4000)}

candidateSources (prioritized list):
${JSON.stringify(input.candidateSources).slice(0, 4000)}
`;

  const result = await groundedModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1400 }
  });
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const parsed = cleanJson(text);
    return PresentationSchema.parse(parsed);
  } catch (e) {
    // Fallback minimal formatting using rawSignals if model output invalid
    const fallbackSources = (input.candidateSources || [])
      .filter(s => !!s.url)
      .slice(0, 6)
      .map((s) => ({ url: s.url, title: s.title || 'Referenced Source', credibility: (s as any).relevance ? Math.min(1, Math.max(0, ((s as any).relevance as number) / 100)) : 0.75 }));
    return PresentationSchema.parse({
      oneLineDescription: `Analysis completed (${input.contentType}, label: ${input.analysisLabel}).`,
      summary: 'The content was analyzed and key indicators were assessed. Some fields could not be formatted due to a model response issue.',
      educationalInsight: 'Apply source verification, cross-reference multiple reputable outlets, and watch for manipulative framing. Use fact-checkers for disputed claims.',
      sources: fallbackSources.length > 0 ? fallbackSources : [
        { url: 'https://www.snopes.com', title: 'Snopes', credibility: 0.9 },
        { url: 'https://www.factcheck.org', title: 'FactCheck.org', credibility: 0.9 },
        { url: 'https://www.politifact.com', title: 'PolitiFact', credibility: 0.88 }
      ]
    });
  }
}
