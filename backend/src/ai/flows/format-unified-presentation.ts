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

type CandidateSource = {
  url: string;
  title?: string;
  snippet?: string;
  relevance?: number;
};

const DEFAULT_PRESENTATION_SOURCES: Presentation['sources'] = [
  { url: 'https://www.snopes.com', title: 'Snopes - Fact Checking', credibility: 0.95 },
  { url: 'https://www.factcheck.org', title: 'FactCheck.org - Nonpartisan Analysis', credibility: 0.93 },
  { url: 'https://www.politifact.com', title: 'PolitiFact - Truth-O-Meter', credibility: 0.91 },
  { url: 'https://fullfact.org', title: 'Full Fact - UK Fact Checking', credibility: 0.89 }
];

const VALID_ANALYSIS_LABELS: ReadonlySet<Presentation['analysisLabel']> = new Set(['RED', 'YELLOW', 'ORANGE', 'GREEN']);

const coercePresentationSource = (entry: any): Presentation['sources'][number] | null => {
  if (!entry || typeof entry !== 'object') return null;
  const url = typeof entry.url === 'string' ? entry.url.trim() : '';
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const title = typeof entry.title === 'string' && entry.title.trim().length > 0
    ? entry.title.trim()
    : 'Verification Resource';
  let credibility: number;
  if (typeof entry.credibility === 'number' && Number.isFinite(entry.credibility)) {
    credibility = entry.credibility;
  } else if (typeof entry.relevance === 'number' && Number.isFinite(entry.relevance)) {
    credibility = entry.relevance / 100;
  } else {
    credibility = 0.8;
  }
  credibility = Math.min(1, Math.max(0, credibility));
  return { url, title, credibility };
};

const normalizeSources = (
  rawSources: any,
  candidateSources: CandidateSource[]
): Presentation['sources'] => {
  const normalized: Presentation['sources'] = [];
  const seen = new Set<string>();
  const addSource = (source: Presentation['sources'][number]) => {
    if (seen.has(source.url)) return;
    normalized.push({ ...source });
    seen.add(source.url);
  };

  if (Array.isArray(rawSources)) {
    rawSources.forEach((entry) => {
      const source = coercePresentationSource(entry);
      if (source) addSource(source);
    });
  }

  for (const candidate of candidateSources || []) {
    if (normalized.length >= 5) break;
    const source = coercePresentationSource({
      url: candidate?.url,
      title: candidate?.title ?? 'Supporting Source',
      credibility: candidate?.relevance != null
        ? Math.min(1, Math.max(0, (candidate.relevance as number) / 100))
        : 0.75
    });
    if (source) addSource(source);
  }

  for (const fallback of DEFAULT_PRESENTATION_SOURCES) {
    if (normalized.length >= 3) break;
    addSource(fallback);
  }

  while (normalized.length < 3) {
    const fallback = DEFAULT_PRESENTATION_SOURCES[normalized.length % DEFAULT_PRESENTATION_SOURCES.length];
    addSource(fallback);
  }

  return normalized.slice(0, 5);
};

const sanitizePresentationFields = (
  parsed: any,
  input: {
    analysisLabel: Presentation['analysisLabel'];
    contentType: 'text' | 'url' | 'image' | 'video' | 'audio';
    candidateSources: CandidateSource[];
  }
): Presentation => {
  const coerceText = (value: any, fallback: string) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return fallback;
  };

  const inferredLabel = typeof parsed?.analysisLabel === 'string'
    ? parsed.analysisLabel.toUpperCase()
    : '';
  const analysisLabel = VALID_ANALYSIS_LABELS.has(inferredLabel as Presentation['analysisLabel'])
    ? (inferredLabel as Presentation['analysisLabel'])
    : input.analysisLabel;

  return {
    analysisLabel,
    oneLineDescription: coerceText(
      parsed?.oneLineDescription,
      `Analysis of ${input.contentType} content`
    ),
    summary: coerceText(
      parsed?.summary,
      'Detailed summary unavailable due to formatting issues in the AI response.'
    ),
    educationalInsight: coerceText(
      parsed?.educationalInsight,
      'Exercise caution and verify this content using reputable fact-checking sources.'
    ),
    sources: normalizeSources(parsed?.sources, input.candidateSources)
  };
};

// Main JSON parsing with multiple fallback strategies
function parseJsonWithFallbacks(text: string, context: any): any {
  // Remove markdown code fences
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const jsonStart = stripped.indexOf('{');
  if (jsonStart === -1) {
    throw new Error('No JSON object found in AI response');
  }

  // Extract JSON portion
  let base = stripped.substring(jsonStart);
  
  // Find the last valid closing brace that matches our opening
  let braceCount = 0;
  let lastValidEnd = -1;
  let inString = false;
  let escaping = false;
  
  for (let i = 0; i < base.length; i++) {
    const char = base[i];
    
    if (escaping) {
      escaping = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escaping = true;
      continue;
    }
    
    if (char === '"' && !escaping) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          lastValidEnd = i;
        }
      }
    }
  }
  
  // Use the last valid JSON object end if found
  if (lastValidEnd > 0) {
    base = base.substring(0, lastValidEnd + 1);
  }

  const sanitizeStructure = (input: string): string => {
    let output = input;
    
    // Remove control characters and normalize quotes
    output = output
      .replace(/\r\n?/g, '\n')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\n/g, ' ');
    
    // Fix common JSON issues
    output = output
      .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":') // Quote unquoted keys
      .replace(/:\s*'([^']*)'/g, ':"$1"') // Convert single quotes to double
      .replace(/"\s+"/g, '" "') // Normalize spaces between quotes
      .replace(/\s+/g, ' '); // Normalize whitespace
    
    return output;
  };

  // Helper to complete truncated JSON
  const completeJsonStructure = (input: string): string => {
    let result = input.trim();
    
    // Track open structures
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escaping = false;
    let lastChar = '';
    
    for (let i = 0; i < result.length; i++) {
      const char = result[i];
      
      if (escaping) {
        escaping = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escaping = true;
        continue;
      }
      
      if (char === '"' && !escaping) {
        inString = !inString;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
      
      if (char.trim()) lastChar = char;
    }
    
    // If we're in the middle of a string, close it
    if (inString) {
      result += '"';
    }
    
    // Remove trailing comma if present
    if (lastChar === ',') {
      result = result.slice(0, -1);
    }
    
    // Close arrays first
    while (bracketCount > 0) {
      result += ']';
      bracketCount--;
    }
    
    // Close objects
    while (braceCount > 0) {
      result += '}';
      braceCount--;
    }
    
    return result;
  };

  // Advanced JSON repair for truncated responses
  const repairTruncatedJson = (input: string): string => {
    let result = input.trim();
    
    // Check if JSON appears truncated (doesn't end with } or ])
    const lastChar = result[result.length - 1];
    if (lastChar !== '}' && lastChar !== ']') {
      // Find the last complete value
      const lastQuoteIndex = result.lastIndexOf('"');
      const lastCommaIndex = result.lastIndexOf(',');
      const lastColonIndex = result.lastIndexOf(':');
      
      // If we're in the middle of a value
      if (lastColonIndex > Math.max(lastQuoteIndex, lastCommaIndex)) {
        // We're after a colon, need to add a value
        const afterColon = result.substring(lastColonIndex + 1).trim();
        if (!afterColon || afterColon[0] !== '"') {
          result += '""'; // Add empty string value
        } else if (!afterColon.endsWith('"')) {
          result += '"'; // Close the string
        }
      }
      
      // Complete the structure
      result = completeJsonStructure(result);
    }
    
    return result;
  };

  // Smart JSON field reconstruction for partial responses
  const reconstructMissingFields = (partial: any, input: any): any => {
    // If we got a partial response, try to fill in missing required fields
    const result = { ...partial };
    
    // Ensure all required fields exist
    if (!result.oneLineDescription || typeof result.oneLineDescription !== 'string') {
      result.oneLineDescription = `Analysis of ${input.contentType} content - ${input.analysisLabel} risk level`;
    }
    
    if (!result.summary || typeof result.summary !== 'string') {
      // Try to construct from available data
      const claims = input.rawSignals?.claims || [];
      const verifiedCount = claims.filter((c: any) => c.verdict === 'VERIFIED').length;
      const disputedCount = claims.filter((c: any) => c.verdict === 'DISPUTED').length;
      
      if (claims.length > 0) {
        result.summary = `Content analysis found ${claims.length} claims: ${verifiedCount} verified, ${disputedCount} disputed. Risk level: ${input.analysisLabel}.`;
      } else {
        result.summary = `${input.contentType} content analyzed. Risk assessment: ${input.analysisLabel}. Verification recommended through trusted sources.`;
      }
    }
    
    if (!result.educationalInsight || typeof result.educationalInsight !== 'string') {
      const riskInsights = {
        'RED': 'High-risk content detected. Verify all claims through multiple independent sources before sharing. Look for primary sources and official statements.',
        'ORANGE': 'Moderate risk indicators found. Cross-reference key claims with fact-checking organizations. Be cautious of potential misinformation.',
        'YELLOW': 'Some concerns identified. Verify specific claims that seem unusual or sensational. Check publication dates and author credentials.',
        'GREEN': 'Low risk assessment. Content appears credible but always maintain healthy skepticism. Verify if sharing for important decisions.'
      };
      result.educationalInsight = riskInsights[input.analysisLabel as keyof typeof riskInsights] || riskInsights['YELLOW'];
    }
    
    if (!Array.isArray(result.sources) || result.sources.length < 3) {
      result.sources = normalizeSources(result.sources, input.candidateSources);
    }
    
    return result;
  };

  const normalizeValueStrings = (input: string): string => {
    // This function is not needed with the new approach
    return input;
  };

  const fixMissingCommas = (input: string): string => {
    const result: string[] = [];
    const stack: Array<'object' | 'array'> = [];
    let inString = false;
    let escaping = false;

    const peekNextNonWhitespace = (start: number): string | null => {
      for (let j = start; j < input.length; j++) {
        const ch = input[j];
        if (!/\s/.test(ch)) {
          return ch;
        }
      }
      return null;
    };

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      result.push(ch);

      if (escaping) {
        escaping = false;
        continue;
      }

      if (ch === '\\') {
        if (inString) {
          escaping = true;
        }
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (ch === '{') {
        stack.push('object');
        continue;
      }

      if (ch === '[') {
        stack.push('array');
        continue;
      }

      if (ch === '}' || ch === ']') {
        const closing = ch;
        const last = stack.pop();
        const parent = stack[stack.length - 1];
        const next = peekNextNonWhitespace(i + 1);

        if (closing === '}' && last === 'object') {
          if (parent === 'array' && next && next !== ',' && next !== ']') {
            result.push(',');
          } else if (parent === 'object' && next && next !== ',' && next !== '}' && next !== null) {
            result.push(',');
          }
        } else if (closing === ']' && last === 'array') {
          if (parent === 'object' && next && next !== ',' && next !== '}') {
            result.push(',');
          }
        }
        continue;
      }
    }

    return result.join('');
  };

  const attempts: string[] = [base];

  const structural = sanitizeStructure(base);
  if (structural !== base) {
    attempts.push(structural);
  }

  const commaFixed = fixMissingCommas(structural);
  if (commaFixed !== structural) {
    attempts.push(commaFixed);
  }
  
  const completed = completeJsonStructure(commaFixed);
  if (completed !== commaFixed) {
    attempts.push(completed);
  }

  // Define the parsing attempts with the functions available in this scope
  const parsingAttempts: Array<{ method: string; transform: (s: string) => string }> = [
    { method: 'direct', transform: (s) => s },
    { method: 'sanitized', transform: (s) => sanitizeStructure(s) },
    { method: 'repaired', transform: (s) => repairTruncatedJson(sanitizeStructure(s)) },
    { method: 'completed', transform: (s) => completeJsonStructure(sanitizeStructure(s)) },
    { method: 'aggressive', transform: (s) => {
      // Most aggressive: try to extract just the JSON fields we need
      const patterns = {
        oneLineDescription: /"oneLineDescription"\s*:\s*"([^"]*)"/,
        summary: /"summary"\s*:\s*"([^"]*)"/,
        educationalInsight: /"educationalInsight"\s*:\s*"([^"]*)"/,
        analysisLabel: /"analysisLabel"\s*:\s*"(RED|YELLOW|ORANGE|GREEN)"/
      };
      
      const extracted: any = {};
      for (const [key, pattern] of Object.entries(patterns)) {
        const match = s.match(pattern);
        if (match) {
          extracted[key] = match[1];
        }
      }
      
      // Try to extract sources array
      const sourcesMatch = s.match(/"sources"\s*:\s*\[([^\]]*)/s);
      if (sourcesMatch) {
        try {
          // Try to parse the sources portion
          const sourcesStr = '[' + sourcesMatch[1] + ']';
          extracted.sources = JSON.parse(completeJsonStructure(sourcesStr));
        } catch {
          extracted.sources = [];
        }
      }
      
      return JSON.stringify(extracted);
    }}
  ];
  
  let lastError: Error | null = null;
  
  for (const { method, transform } of parsingAttempts) {
    try {
      const transformed = transform(base);
      const parsed = JSON.parse(transformed);
      
      // Ensure we have valid data
      if (parsed && typeof parsed === 'object') {
        // Fill in any missing fields
        return reconstructMissingFields(parsed, context);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next attempt
    }
  }
  
  // If all parsing attempts failed, return a fully constructed fallback
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[WARN] All JSON parsing attempts failed, using constructed fallback');
  }
  
  return reconstructMissingFields({}, context);
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
      const parsed = parseJsonWithFallbacks(text, {
        contentType: input.contentType,
        analysisLabel: input.analysisLabel,
        rawSignals: input.rawSignals,
        candidateSources: input.candidateSources
      });
      const normalized = sanitizePresentationFields(parsed, {
        analysisLabel: input.analysisLabel,
        contentType: input.contentType,
        candidateSources: input.candidateSources
      });
      return PresentationSchema.parse(normalized);
    } catch (e) {
      // Parsing failed, but parseJsonWithFallbacks should have handled it
      // This catch block should rarely be reached
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[WARN] Presentation formatting error:', e instanceof Error ? e.message : 'Unknown error');
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
    
    return PresentationSchema.parse(sanitizePresentationFields({
      analysisLabel: input.analysisLabel,
      oneLineDescription: `${input.contentType.charAt(0).toUpperCase() + input.contentType.slice(1)} analysis completed - ${input.analysisLabel} risk level detected`,
      summary: summaryText,
      educationalInsight: educationalText,
      sources: fallbackSources.length >= 3 ? fallbackSources : defaultSources.slice(0, 5)
    }, {
      analysisLabel: input.analysisLabel,
      contentType: input.contentType,
      candidateSources: input.candidateSources
    }));
  } catch (e) {
    console.error('[ERROR] Unexpected error in formatUnifiedPresentation:', e instanceof Error ? e.message : 'Unknown error');
    throw e;
  }
}
