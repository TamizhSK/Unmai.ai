'use server';
import { z } from 'zod';
import { groundedModel } from '../genkit.js';

const PresentationSchema = z.object({
  analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']),
  oneLineDescription: z.string().min(1),
  summary: z.string().min(1),
  educationalInsight: z.string().min(1),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string().min(1),
    credibility: z.number().min(0).max(1)
  })).min(3)
});
export type Presentation = z.infer<typeof PresentationSchema>;

function cleanJson(text: string): any {
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const jsonStart = stripped.indexOf('{');
  if (jsonStart === -1) {
    throw new Error('No JSON object found in AI response');
  }

  const base = (() => {
    const jsonEnd = stripped.lastIndexOf('}');
    if (jsonEnd !== -1 && jsonEnd > jsonStart) {
      return stripped.substring(jsonStart, jsonEnd + 1);
    }
    return stripped.substring(jsonStart);
  })();

  const sanitizeStructure = (input: string): string => {
    let output = input;
    output = output
      .replace(/\r\n?/g, '\n')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/,\s*([}\]])/g, (_match, closing) => closing)
      .replace(/"([^"\\]*?)\\"(\s*:)/g, (_match, key, suffix) => `"${key}"${suffix}`)
      .replace(/"([^"\\]+)""(\s*:)/g, (_match, key, suffix) => `"${key}"${suffix}`)
      .replace(/:\s*""([^"\\]*?)"/g, (_match, value) => `: "${value}"`)
      .replace(/:""([^"\\]*?)"/g, (_match, value) => `:"${value}"`)
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, (_match, prefix, key) => `${prefix}"${key}":`)
      .replace(/(?<!\\)"{3,}/g, '"')
      .replace(/(?<!\\)""/g, '"')
      .replace(/}\s*(?=\s*{)/g, '}, ');
    return output;
  };

  const balanceContainers = (input: string): string => {
    let output = input;
    const openBraces = (output.match(/{/g) ?? []).length;
    const closeBraces = (output.match(/}/g) ?? []).length;
    if (closeBraces < openBraces) {
      output += '}'.repeat(openBraces - closeBraces);
    }

    const openBrackets = (output.match(/\[/g) ?? []).length;
    const closeBrackets = (output.match(/]/g) ?? []).length;
    if (closeBrackets < openBrackets) {
      output += ']'.repeat(openBrackets - closeBrackets);
    }

    return output;
  };

  const sanitizeWhitespace = (input: string): string => {
    return input
      .replace(/"([^"\\]*?)\n([^"\\]*?)"/g, (_match, before, after) => `"${before}\\n${after}"`)
      .replace(/"([^"\\]*?)\t([^"\\]*?)"/g, (_match, before, after) => `"${before}\\t${after}"`)
      .replace(/"\s*:/g, '":')
      .replace(/:\s*"\s*/g, ': "');
  };

  const normalizeValueStrings = (input: string): string => {
    const out: string[] = [];
    let i = 0;
    while (i < input.length) {
      const ch = input[i];
      if (ch === ':') {
        out.push(ch);
        i++;
        while (i < input.length && /\s/.test(input[i])) {
          out.push(input[i]);
          i++;
        }
        if (i < input.length && input[i] === '"') {
          out.push('"');
          i++;
          let closed = false;
          while (i < input.length) {
            const c = input[i];
            if (c === '\\') {
              out.push(c);
              if (i + 1 < input.length) {
                out.push(input[i + 1]);
                i += 2;
              } else {
                i++;
              }
              continue;
            }
            if (c === '"') {
              let k = i + 1;
              while (k < input.length && /\s/.test(input[k])) k++;
              if (k >= input.length || ',}]'.includes(input[k])) {
                out.push('"');
                i++;
                closed = true;
                break;
              }
              out.push('\\"');
              i++;
              continue;
            }
            out.push(c);
            i++;
          }
          if (!closed) {
            out.push('"');
          }
          continue;
        }
        continue;
      }
      out.push(ch);
      i++;
    }
    return out.join('');
  };

  const attempts: string[] = [base];

  const structural = sanitizeStructure(base);
  if (structural !== base) {
    attempts.push(structural);
  }

  const whitespaceNormalized = sanitizeWhitespace(structural);
  if (whitespaceNormalized !== structural) {
    attempts.push(whitespaceNormalized);
  }
  const balanced = balanceContainers(whitespaceNormalized);
  if (balanced !== whitespaceNormalized) {
    attempts.push(balanced);
  }

  const valueNormalized = normalizeValueStrings(balanced);
  if (valueNormalized !== balanced) {
    attempts.push(valueNormalized);
  }

  // Helper to close unterminated strings and ensure object closure
  const closeOpenString = (jsonStr: string): string => {
    // First, close any unterminated string by adding quote at end if odd quotes
    let fixed = jsonStr.trim();
    
    // Remove any trailing commas before closing braces/brackets
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    // Count quotes to ensure they're balanced
    const quoteMatches = fixed.match(/"/g) || [];
    if (quoteMatches.length % 2 === 1) {
      fixed = fixed + '"';
    }
    
    // Ensure object/array is properly closed
    const openBraces = (fixed.match(/{/g) || []).length;
    const closeBraces = (fixed.match(/}/g) || []).length;
    if (closeBraces < openBraces) {
      fixed = fixed + '}'.repeat(openBraces - closeBraces);
    }
    
    // Ensure no trailing commas in arrays/objects
    fixed = fixed.replace(/,(\s*[}\]])(?=([^"]*"[^"]*")*[^"]*$)/g, '$1');
    
    return fixed;
  };

  // Try each candidate in sequence
  let lastParseError: Error | null = null;
  for (let i = 0; i < attempts.length; i++) {
    try {
      const candidate = attempts[i];
      // First try direct parse
      return JSON.parse(candidate);
    } catch (error) {
      lastParseError = error instanceof Error ? error : new Error(String(error));
      // If this is the last attempt, try with salvage
      if (i === attempts.length - 1) {
        const lastCandidate = attempts[attempts.length - 1] || base;
        const salvaged = closeOpenString(lastCandidate);
        try {
          return JSON.parse(salvaged);
        } catch (salvageError) {
          // Log minimal error info
          const snippet = lastCandidate.substring(0, 200) + (lastCandidate.length > 200 ? '...' : '');
          const context = { error: lastParseError.message, attempt: i + 1, snippet };
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[WARN] Presentation JSON salvage failed', context);
          } else {
            console.warn('[WARN] Presentation JSON salvage failed');
          }
          throw new Error('Failed to process AI response. The content may be malformed.');
        }
      }
    }
  }
  throw lastParseError || new Error('No valid JSON could be parsed from the response');
}

// Helper function to check if JSON is properly formatted

export async function formatUnifiedPresentation(input: {
  contentType: 'text' | 'url' | 'image' | 'video' | 'audio';
  analysisLabel: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  rawSignals: Record<string, any>; // claims, ocrText, transcription, threats, deepfake, etc.
  candidateSources: Array<{ url: string; title?: string; snippet?: string; relevance?: number }>;
}): Promise<Presentation> {
  const prompt = `You are a professional misinformation analyst. Generate factual, informative content based on the analysis results.

Task: Convert the analysis signals below into a clean, factual presentation for users.

CONTENT GENERATION RULES:
1. Generate FACTUAL, INFORMATIVE content - not generic placeholders
2. Use the rawSignals data to create specific, detailed descriptions
3. Reference actual findings from the analysis
4. Be specific about what was analyzed and what was found
5. Provide educational value based on the actual content

CRITICAL JSON FORMATTING:
- ONLY valid JSON - no markdown, backticks, or extra text
- Use double quotes for all strings
- Escape quotes with backslash
- No line breaks in strings - use spaces
- No control characters

Required JSON format:
{
  "oneLineDescription": "Specific description of what was analyzed and the key finding",
  "summary": "Detailed factual summary of the analysis results with specific findings",
  "educationalInsight": "Practical guidance based on the actual analysis results",
  "sources": [
    {"url": "valid_url", "title": "descriptive_title", "credibility": 0.9}
  ]
}

IMPORTANT: Generate content that reflects the actual analysis - not generic templates!

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

  try {
    const result = await groundedModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2000 }
    });
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      throw new Error('Empty response from AI model');
    }
    
    try {
      const parsed = cleanJson(text);
      // Ensure required fields like analysisLabel are present even if the model omits them
      const normalized = { ...parsed, analysisLabel: input.analysisLabel };
      return PresentationSchema.parse(normalized);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[WARN] Presentation JSON parse failed; using fallback:', e);
        console.warn('[DEBUG] Raw AI snippet:', text.substring(0, 300));
      } else {
        console.warn('[WARN] Presentation JSON parse failed; using fallback');
      }
    }

    // Generate fallback response if AI response parsing fails
    const claims = input.rawSignals?.claims || [];
    const verifiedCount = claims.filter((c: any) => c.verdict === 'VERIFIED').length;
    const disputedCount = claims.filter((c: any) => c.verdict === 'DISPUTED').length;
    const totalClaims = claims.length;
    
    let summaryText = `Analysis of ${input.contentType} content with ${totalClaims} claim${totalClaims !== 1 ? 's' : ''} examined.`;
    if (totalClaims > 0) {
      summaryText += ` ${verifiedCount} verified, ${disputedCount} disputed.`;
      if (disputedCount > 0) {
        summaryText += ' Contains potentially false or misleading information.';
      }
    }

    let educationalText = 'Key protection strategies: Verify claims through multiple independent sources, check publication dates, examine author credentials, and cross-reference with established fact-checking organizations.';
    
    if (input.analysisLabel === 'RED') {
      educationalText += ' This content shows high-risk indicators - exercise extreme caution before sharing.';
    }
    
    const fallbackSources = (input.candidateSources || [])
      .filter(s => s.url && s.url.startsWith('http'))
      .slice(0, 6)
      .map((s) => ({
        url: s.url,
        title: s.title || 'Verification Resource',
        credibility: (s as any).relevance
          ? Math.min(1, Math.max(0.5, ((s as any).relevance as number) / 100))
          : 0.8
      }));
    
    const defaultSources = [
      { url: 'https://www.snopes.com', title: 'Snopes - Fact Checking', credibility: 0.95 },
      { url: 'https://www.factcheck.org', title: 'FactCheck.org - Nonpartisan Analysis', credibility: 0.93 },
      { url: 'https://www.politifact.com', title: 'PolitiFact - Truth-O-Meter', credibility: 0.91 },
      { url: 'https://fullfact.org', title: 'Full Fact - UK Fact Checking', credibility: 0.89 }
    ];
    
    return PresentationSchema.parse({
      analysisLabel: input.analysisLabel,
      oneLineDescription: `${input.contentType.charAt(0).toUpperCase() + input.contentType.slice(1)} analysis completed - ${input.analysisLabel} risk level detected`,
      summary: summaryText,
      educationalInsight: educationalText,
      sources: fallbackSources.length >= 3 ? fallbackSources : defaultSources.slice(0, 5)
    });
  } catch (e) {
    console.error('[ERROR] Unexpected error in formatUnifiedPresentation:', e instanceof Error ? e.message : 'Unknown error');
    throw e;
  }
}
