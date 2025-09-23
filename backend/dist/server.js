import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { factCheckClaim } from './ai/flows/fact-check-claim.js';
import { getCredibilityScore } from './ai/flows/get-credibility-score.js';
import { detectDeepfake } from './ai/flows/detect-deepfake.js';
import { analyzeUnified } from './ai/flows/unified-analysis.js';
import { assessSafety } from './ai/flows/safety-assessment.js';
import { verifySource } from './ai/flows/verify-source.js';
import { performWebAnalysis } from './ai/flows/perform-web-analysis.js';
import { safeSearchUrl } from './ai/flows/safe-search-url.js';
import { translateTextFlow } from './ai/flows/translate-text.js';
// Load environment variables
config();
// Validate required environment variables
const requiredEnvVars = ['GCP_PROJECT_ID', 'GEMINI_API_KEY'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`[ERROR] Missing required environment variable: ${envVar}`);
        console.error('Please check your .env file and ensure all required variables are set.');
        process.exit(1);
    }
}
console.log('[INFO] Environment variables loaded successfully');
const app = express();
const PORT = process.env.PORT || 3001;
const REQUEST_SIZE_LIMIT = process.env.REQUEST_SIZE_LIMIT || '50mb';
app.use(cors());
app.use(express.json({ limit: REQUEST_SIZE_LIMIT }));
// Unified multimodal endpoint (preferred)
app.post('/api/analyze', async (req, res) => {
    try {
        const { type, payload, searchEngineId } = req.body || {};
        if (!type || !payload) {
            return res.status(400).json({ error: 'type and payload are required' });
        }
        const result = await analyzeUnified({ type, payload }, { searchEngineId });
        res.json(result);
    }
    catch (error) {
        console.error('[ERROR] Unified analyze API failed:', error);
        res.status(500).json({
            error: 'Unified analysis service unavailable',
            message: 'Unable to analyze content at this time',
            timestamp: new Date().toISOString()
        });
    }
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API Routes
app.post('/api/fact-check', async (req, res) => {
    try {
        const { claim } = req.body;
        if (!claim) {
            return res.status(400).json({ error: 'Claim is required' });
        }
        const result = await factCheckClaim({ claim });
        res.json(result);
    }
    catch (error) {
        console.error('[ERROR] Fact-checking API failed:', error);
        res.status(500).json({
            error: 'Fact-checking service unavailable',
            message: 'Unable to process fact-check request at this time',
            timestamp: new Date().toISOString()
        });
    }
});
// Removed modality-specific analyze endpoints in favor of unified /api/analyze
app.post('/api/credibility-score', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        const result = await getCredibilityScore({ content: text, contentType: 'text' });
        res.json(result);
    }
    catch (error) {
        console.error('[ERROR] Credibility scoring API failed:', error);
        res.status(500).json({
            error: 'Credibility scoring service unavailable',
            message: 'Unable to calculate credibility score at this time',
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/detect-deepfake', async (req, res) => {
    try {
        const { media, contentType, sourceCredibility } = req.body;
        if (!media || !contentType) {
            return res.status(400).json({ error: 'Media and contentType are required' });
        }
        const result = await detectDeepfake({
            media,
            contentType: contentType
        }, sourceCredibility);
        res.json(result);
    }
    catch (error) {
        console.error('[ERROR] Deepfake detection API failed:', error);
        res.status(500).json({
            error: 'Deepfake detection service unavailable',
            message: 'Unable to analyze media for deepfakes at this time',
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/safety-assessment', async (req, res) => {
    try {
        const { content, contentType } = req.body;
        if (!content || !contentType) {
            return res.status(400).json({ error: 'Content and contentType are required' });
        }
        const result = await assessSafety({
            content,
            contentType: contentType
        });
        res.json(result);
    }
    catch (error) {
        console.error('[ERROR] Safety assessment API failed:', error);
        res.status(500).json({
            error: 'Safety assessment service unavailable',
            message: 'Unable to assess content safety at this time',
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/verify-source', async (req, res) => {
    try {
        const { content, contentType } = req.body;
        if (!content || !contentType) {
            return res.status(400).json({ error: 'Content and contentType are required' });
        }
        const result = await verifySource({
            content,
            contentType: contentType
        });
        res.json(result);
    }
    catch (error) {
        console.error('[ERROR] Source verification API failed:', error);
        res.status(500).json({
            error: 'Source verification service unavailable',
            message: 'Unable to verify source credibility at this time',
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/web-analysis', async (req, res) => {
    try {
        const { query, contentType, searchEngineId } = req.body;
        if (!query || !contentType) {
            return res.status(400).json({ error: 'Query and contentType are required' });
        }
        const result = await performWebAnalysis({
            query,
            contentType: contentType,
            searchEngineId
        });
        res.json(result);
    }
    catch (error) {
        console.error('[ERROR] Web analysis API failed:', error);
        res.status(500).json({
            error: 'Web analysis service unavailable',
            message: 'Unable to analyze web content at this time',
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/safe-search', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        const result = await safeSearchUrl({ url });
        res.json(result);
    }
    catch (error) {
        console.error('[ERROR] Safe search API failed:', error);
        res.status(500).json({
            error: 'Safe search service unavailable',
            message: 'Unable to verify URL safety at this time',
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/translate-text', async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        if (!text || !targetLanguage) {
            return res.status(400).json({ error: 'Text and targetLanguage are required' });
        }
        const result = await translateTextFlow({ text, targetLanguage });
        res.json(result);
    }
    catch (error) {
        console.error('[ERROR] Text translation API failed:', error);
        res.status(500).json({
            error: 'Translation service unavailable',
            message: 'Unable to translate text at this time',
            timestamp: new Date().toISOString()
        });
    }
});
// Start server with error handling
const server = app.listen(PORT, () => {
    console.log(`[INFO] unmai.ai Backend server running on port ${PORT}`);
    console.log(`[INFO] Health check available at: http://localhost:${PORT}/health`);
    console.log(`[INFO] CORS enabled for all origins`);
    console.log(`[INFO] Request size limit: ${REQUEST_SIZE_LIMIT}`);
    console.log(`[INFO] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('[INFO] Server started successfully!\n');
});
// Handle server startup errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`[ERROR] Port ${PORT} is already in use`);
        console.error('[TIP] Try using a different port or kill the process using this port:');
        console.error(`   lsof -ti:${PORT} | xargs kill -9`);
        process.exit(1);
    }
    else if (error.code === 'EACCES') {
        console.error(`[ERROR] Permission denied to bind to port ${PORT}`);
        console.error('[TIP] Try using a port number above 1024 or run with sudo');
        process.exit(1);
    }
    else {
        console.error('[ERROR] Server startup error:', error);
        process.exit(1);
    }
});
// Graceful shutdown handling
const shutdown = (signal) => {
    console.log(`\n[INFO] Received ${signal}. Starting graceful shutdown...`);
    server.close((err) => {
        if (err) {
            console.error('[ERROR] Error during server shutdown:', err);
            process.exit(1);
        }
        console.log('[INFO] Server closed successfully');
        console.log('[INFO] unmai.ai Backend shutdown complete');
        process.exit(0);
    });
    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.log('[WARN] Forcing server shutdown after timeout');
        process.exit(1);
    }, 10000);
};
// Handle different termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    console.error('[ERROR] Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
});
//# sourceMappingURL=server.js.map