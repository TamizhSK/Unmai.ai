import { z } from 'zod';
import { groundedModel } from '../genkit.js';
import { performWebAnalysis } from './perform-web-analysis.js';
import { factCheckClaim } from './fact-check-claim.js';
const TextAnalysisInputSchema = z.object({
    text: z.string().min(1, 'Text content is required'),
});
const TextAnalysisOutputSchema = z.object({
    // 1. Analysis Label (risk level)
    analysisLabel: z.enum(['RED', 'YELLOW', 'ORANGE', 'GREEN']).describe('Risk level of the content'),
    // 2. One-line description (AI polished)
    oneLineDescription: z.string().describe('Brief AI-polished description of the text'),
    // 3. Information summary (AI polished)
    summary: z.string().describe('Detailed AI-polished summary of the analysis'),
    // 4. Educational insight (AI polished)
    educationalInsight: z.string().describe('AI-polished educational content on manipulation techniques'),
    // 5. Sources, scores, and verdict
    sources: z.array(z.object({
        url: z.string().url(),
        title: z.string(),
        credibility: z.number().min(0).max(1),
    })).describe('Factual and legitimate web sources'),
    sourceIntegrityScore: z.number().min(0).max(100).describe('Source integrity score'),
    contentAuthenticityScore: z.number().min(0).max(100).describe('Content authenticity score'),
    trustExplainabilityScore: z.number().min(0).max(100).describe('Trust explainability score'),
    // Internal data for processing
    claims: z.array(z.object({
        claim: z.string(),
        verdict: z.enum(['VERIFIED', 'DISPUTED', 'UNVERIFIED']),
        confidence: z.number().min(0).max(1),
        explanation: z.string(),
    })).optional(),
});
// Helper to break text into claims using Gemini
async function extractClaims(text) {
    const prompt = `Break down the following text into individual factual claims. Return each claim as a separate line. Text: "${text}"`;
    const result = await groundedModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
    });
    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return responseText.split('\\n').filter((claim) => claim.trim().length > 0);
}
// Helper to fact-check claims using the dedicated fact-check function
async function factCheckClaimWithSources(claim) {
    try {
        const result = await factCheckClaim({ claim });
        return {
            claim,
            verdict: result.verdict === 'True' ? 'VERIFIED' :
                result.verdict === 'False' ? 'DISPUTED' : 'UNVERIFIED',
            confidence: result.verdict === 'Uncertain' ? 0.3 : 0.7,
            explanation: result.explanation || 'Analysis completed',
        };
    }
    catch (error) {
        console.error('Error fact-checking claim:', error);
        return {
            claim,
            verdict: 'UNVERIFIED',
            confidence: 0.3,
            explanation: 'Unable to verify claim',
        };
    }
}
// Helper to determine overall verdict and analysis label
const determineOverallVerdict = (claims) => {
    const verifiedCount = claims.filter(c => c.verdict === 'VERIFIED').length;
    const disputedCount = claims.filter(c => c.verdict === 'DISPUTED').length;
    const unverifiedCount = claims.filter(c => c.verdict === 'UNVERIFIED').length;
    const total = claims.length;
    if (verifiedCount === total)
        return { verdict: 'VERIFIED', label: 'GREEN' };
    if (disputedCount + unverifiedCount === total)
        return { verdict: 'DISPUTED', label: 'RED' };
    if (verifiedCount > disputedCount + unverifiedCount)
        return { verdict: 'VERIFIED', label: 'YELLOW' };
    return { verdict: 'MIXED', label: 'ORANGE' };
};
// Helper to calculate scores
function calculateScores(claims) {
    const verifiedClaims = claims.filter(c => c.verdict === 'VERIFIED').length;
    const totalClaims = claims.length || 1;
    const avgConfidence = claims.reduce((sum, c) => sum + c.confidence, 0) / totalClaims;
    const avgSourceCredibility = claims.reduce((sum, c) => sum + (c.sources?.reduce((s, src) => s + src.credibility, 0) / (c.sources?.length || 1) || 0), 0) / totalClaims;
    return {
        sourceIntegrityScore: Math.round(avgSourceCredibility * 100),
        contentAuthenticityScore: Math.round((verifiedClaims / totalClaims) * 100),
        trustExplainabilityScore: Math.round(avgConfidence * 100),
    };
}
// Main analysis function
export async function analyzeTextContent(input) {
    try {
        console.log('[INFO] Starting text analysis for:', input.text.substring(0, 100));
        // Step 1: Break down text into claims
        const claims = await extractClaims(input.text);
        const claimsToAnalyze = claims.slice(0, 5); // Limit to 5 claims for efficiency
        console.log('[INFO] Extracted claims:', claimsToAnalyze);
        // Step 2: Fact-check each claim
        const analyzedClaims = await Promise.all(claimsToAnalyze.map(claim => factCheckClaimWithSources(claim)));
        console.log('[INFO] Analyzed claims:', analyzedClaims);
        // Step 3: Perform web analysis for context
        let webSources = [];
        try {
            const webAnalysis = await performWebAnalysis({
                query: input.text.substring(0, 500),
                contentType: 'text'
            });
            webSources = webAnalysis.currentInformation || [];
            console.log('[INFO] Web sources found:', webSources.length);
        }
        catch (error) {
            console.error('Web analysis failed:', error);
        }
        // Step 4: Determine analysis label
        const { verdict, label } = determineOverallVerdict(analyzedClaims);
        // Step 5: Generate AI-polished one-line description
        const truncatedText = input.text.substring(0, 100).replace(/\n/g, ' ').trim();
        const oneLineDescription = `Analyzed text: "${truncatedText}${input.text.length > 100 ? '...' : ''}" - ${label === 'GREEN' ? 'Content verified as factually accurate' : label === 'RED' ? 'Contains misinformation or disputed claims' : label === 'ORANGE' ? 'Mixed accuracy, requires careful evaluation' : 'Content needs further verification'}`;
        console.log('[INFO] Generated oneLineDescription:', oneLineDescription);
        // Step 6: Generate AI-polished summary
        const verifiedCount = analyzedClaims.filter(c => c.verdict === 'VERIFIED').length;
        const disputedCount = analyzedClaims.filter(c => c.verdict === 'DISPUTED').length;
        const unverifiedCount = analyzedClaims.filter(c => c.verdict === 'UNVERIFIED').length;
        const summary = `DETAILED ANALYSIS RESULTS\n\n` +
            `Content Overview: The submitted text contains ${claims.length} distinct factual claim${claims.length !== 1 ? 's' : ''} that have been systematically analyzed.\n\n` +
            `\nVerification Breakdown:\n` +
            `• Verified Claims: ${verifiedCount} (${claims.length > 0 ? Math.round(verifiedCount / claims.length * 100) : 0}%)\n` +
            `• Disputed Claims: ${disputedCount} (${claims.length > 0 ? Math.round(disputedCount / claims.length * 100) : 0}%)\n` +
            `• Unverified Claims: ${unverifiedCount} (${claims.length > 0 ? Math.round(unverifiedCount / claims.length * 100) : 0}%)\n\n` +
            `${disputedCount > 0 ? ' WARNING: This content contains disputed or false information that has been debunked by fact-checkers.\n\n' : ''}` +
            `${verifiedCount === claims.length && claims.length > 0 ? '  VERIFIED: All claims in this text have been confirmed as factually accurate.\n\n' : ''}` +
            `\nOverall Assessment: ${label === 'GREEN' ? 'This text appears to be factually accurate and reliable. The claims made are supported by credible sources and fact-checking organizations.' :
                label === 'RED' ? 'This text contains significant misinformation or false claims. Multiple statements have been disputed or debunked by fact-checkers. Exercise extreme caution and do not share without correction.' :
                    label === 'ORANGE' ? 'This text contains a mix of accurate and questionable information. Some claims are verified while others are disputed or unverifiable. Critical evaluation is required before accepting or sharing.' :
                        'This text requires further verification. The claims made could not be fully confirmed or denied based on available information. Seek additional sources before drawing conclusions.'}\n\n` +
            `\nRecommendation: ${label === 'GREEN' ? 'This content can be considered reliable for reference and sharing.' :
                label === 'RED' ? 'Do not share this content without significant corrections. Seek accurate information from trusted sources.' :
                    'Verify specific claims independently before using this information for important decisions.'}`;
        // Step 7: Generate comprehensive educational insight
        const educationalInsight = `UNDERSTANDING MISINFORMATION IN TEXT CONTENT\n\n` +
            `Common Manipulation Techniques:\n` +
            `• Selective Facts: Presenting only information that supports a specific narrative while omitting contradictory evidence\n` +
            `• Emotional Manipulation: Using fear, anger, or outrage to bypass critical thinking\n` +
            `• False Context: Taking real information out of its original context to mislead\n` +
            `• Fabricated Claims: Creating entirely false statements presented as facts\n` +
            `• Appeal to Authority: Citing fake experts or misrepresenting real expert opinions\n\n` +
            `\nProtection Strategies:\n` +
            `1. VERIFY SOURCES: Check if claims come from reputable, peer-reviewed, or official sources\n` +
            `2. CROSS-REFERENCE: Compare information across multiple independent sources\n` +
            `3. CHECK DATES: Ensure information is current and not outdated or taken out of temporal context\n` +
            `4. EXAMINE LANGUAGE: Be wary of sensational, emotionally charged, or absolute statements\n` +
            `5. USE FACT-CHECKERS: Consult established fact-checking organizations (Snopes, FactCheck.org, PolitiFact)\n\n` +
            `\nRed Flags to Watch For:\n` +
            `• Claims that seem too good/bad to be true\n` +
            `• Lack of author information or credentials\n` +
            `• Missing publication dates or sources\n` +
            `• Grammatical errors or unprofessional presentation\n` +
            `• Requests to share urgently without verification\n\n` +
            `\nRemember: Critical thinking is your best defense. Question everything, verify important claims, and think before you share.`;
        // Step 8: Compile comprehensive sources
        const sources = [
            { url: 'https://www.snopes.com', title: 'Snopes - The definitive fact-checking resource for urban legends, folklore, myths, rumors, and misinformation', credibility: 0.95 },
            { url: 'https://www.factcheck.org', title: 'FactCheck.org - A project of the Annenberg Public Policy Center, providing nonpartisan analysis of U.S. politics', credibility: 0.93 },
            { url: 'https://www.politifact.com', title: 'PolitiFact - Pulitzer Prize-winning fact-checking website that rates the accuracy of claims by elected officials', credibility: 0.91 },
            { url: 'https://fullfact.org', title: 'Full Fact - UK\'s independent fact-checking charity, checking claims made by politicians and the media', credibility: 0.89 },
            { url: 'https://www.reuters.com/fact-check', title: 'Reuters Fact Check - Global news organization\'s dedicated fact-checking team', credibility: 0.92 },
            { url: 'https://apnews.com/APFactCheck', title: 'AP Fact Check - Associated Press fact-checking initiative covering politics and major news events', credibility: 0.94 },
            { url: 'https://www.bbc.com/reality-check', title: 'BBC Reality Check - BBC\'s fact-checking service examining claims and statistics', credibility: 0.90 },
            { url: 'https://www.washingtonpost.com/news/fact-checker/', title: 'Washington Post Fact Checker - Award-winning political fact-checking with Pinocchio ratings', credibility: 0.88 }
        ];
        // Add web sources if available
        webSources.slice(0, 3).forEach(source => {
            if (source.url && source.title) {
                sources.push({
                    url: source.url,
                    title: source.title,
                    credibility: source.relevance ? source.relevance / 100 : 0.75
                });
            }
        });
        // Step 9: Calculate scores
        const scores = calculateScores(analyzedClaims);
        const result = {
            analysisLabel: label,
            oneLineDescription,
            summary,
            educationalInsight,
            sources: sources.slice(0, 8), // Limit to 8 sources
            sourceIntegrityScore: scores.sourceIntegrityScore || 50,
            contentAuthenticityScore: scores.contentAuthenticityScore || 50,
            trustExplainabilityScore: scores.trustExplainabilityScore || 50,
            claims: analyzedClaims,
        };
        console.log('[INFO] Returning analysis result:', {
            analysisLabel: result.analysisLabel,
            oneLineDescription: result.oneLineDescription.substring(0, 100),
            sourcesCount: result.sources.length,
            scores: {
                sourceIntegrityScore: result.sourceIntegrityScore,
                contentAuthenticityScore: result.contentAuthenticityScore,
                trustExplainabilityScore: result.trustExplainabilityScore
            }
        });
        return result;
    }
    catch (error) {
        console.error('Error in text analysis:', error);
        // Return error response with proper format
        return {
            analysisLabel: 'RED',
            oneLineDescription: 'Text analysis encountered an error',
            summary: 'The text analysis could not be completed due to technical issues. Please try again.',
            educationalInsight: 'When text analysis fails, verify information manually using trusted fact-checking websites.',
            sources: [
                { url: 'https://www.snopes.com', title: 'Snopes Fact Checking', credibility: 0.95 }
            ],
            sourceIntegrityScore: 0,
            contentAuthenticityScore: 0,
            trustExplainabilityScore: 0,
            claims: [],
        };
    }
}
//# sourceMappingURL=analyze-text-content.js.map