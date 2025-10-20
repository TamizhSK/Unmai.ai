import express from 'express';
import type { Request, Response, NextFunction } from 'express';
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

// Load environment variables with JWT support
try {
  // Try to load JWT environment first (production/secure)
  const { loadJWTEnvironment } = await import('./lib/jwt-env-loader.js');
  await loadJWTEnvironment();
} catch (error) {
  // Fallback to regular dotenv (development)
  console.log('[INFO] JWT environment not available, using dotenv fallback');
  config();
}

// Validate required environment variables
const requiredEnvVars = ['GCP_PROJECT_ID', 'GEMINI_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Validate optional Custom Search configuration
const customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const customSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
if (customSearchKey && customSearchEngineId) {
  console.log('Google Custom Search API configured');
} else if (customSearchKey || customSearchEngineId) {
  console.warn('Partial Custom Search configuration - both API key and Search Engine ID are needed');
}

const app = express();
const PORT = process.env.PORT || 3001;
const REQUEST_SIZE_LIMIT = process.env.REQUEST_SIZE_LIMIT || '50mb';

app.use(cors());
app.use(express.json({ limit: REQUEST_SIZE_LIMIT }));
// Support form submissions (e.g. multipart clients sending urlencoded payloads)
app.use(express.urlencoded({ extended: true, limit: REQUEST_SIZE_LIMIT }));

// Unified multimodal endpoint (preferred)
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { type, payload, searchEngineId } = req.body || {};
    if (!type || !payload) {
      return res.status(400).json({ error: 'type and payload are required' });
    }
    const result = await analyzeUnified({ type, payload } as any, { searchEngineId });
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Unified analyze failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Unified analysis service unavailable',
      message: 'Unable to analyze content at this time',
      timestamp: new Date().toISOString()
    });
  }
});


// Simple health check endpoint (fast response)
app.get('/health', (req: Request, res: Response) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  // Add test mode indicator if running in test mode
  if (process.argv.includes('--test-mode')) {
    healthStatus.status = 'test';
    // Exit after health check in test mode
    setTimeout(() => process.exit(0), 100);
  }

  res.json(healthStatus);
});

// Detailed health check endpoint (more comprehensive)
app.get('/health/detailed', (req: Request, res: Response) => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    services: {
      geminiApi: !!process.env.GEMINI_API_KEY,
      gcpProject: !!process.env.GCP_PROJECT_ID,
      customSearch: {
        configured: !!(customSearchKey && customSearchEngineId),
        hasApiKey: !!customSearchKey,
        hasEngineId: !!customSearchEngineId
      }
    },
    buildInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };

  res.json(healthStatus);
});

// Custom Search test endpoint
app.get('/api/test-search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string || 'test search';
    const { performWebAnalysis } = await import('./ai/flows/perform-web-analysis.js');

    const result = await performWebAnalysis({
      query,
      contentType: 'text',
      mediaType: 'text'
    });

    res.json({
      success: true,
      query,
      resultsCount: result.currentInformation?.length || 0,
      results: result.currentInformation?.slice(0, 3) || [],
      summary: result.analysisSummary
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Custom Search test failed: ${errorMessage}`);
    res.status(500).json({
      success: false,
      error: 'Custom Search test failed',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.post('/api/fact-check', async (req: Request, res: Response) => {
  try {
    const { claim } = req.body;
    if (!claim) {
      return res.status(400).json({ error: 'Claim is required' });
    }
    const result = await factCheckClaim({ claim });
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Fact-checking failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Fact-checking service unavailable',
      message: 'Unable to process fact-check request at this time',
      timestamp: new Date().toISOString()
    });
  }
});

// Removed modality-specific analyze endpoints in favor of unified /api/analyze

app.post('/api/credibility-score', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const result = await getCredibilityScore({ content: text, contentType: 'text' });
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Credibility scoring failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Credibility scoring service unavailable',
      message: 'Unable to calculate credibility score at this time',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/detect-deepfake', async (req: Request, res: Response) => {
  try {
    const { media, contentType, sourceCredibility } = req.body;
    if (!media || !contentType) {
      return res.status(400).json({ error: 'Media and contentType are required' });
    }
    const result = await detectDeepfake({
      media,
      contentType: contentType as 'image' | 'video'
    }, sourceCredibility);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Deepfake detection failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Deepfake detection service unavailable',
      message: 'Unable to analyze media for deepfakes at this time',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/safety-assessment', async (req: Request, res: Response) => {
  try {
    const { content, contentType } = req.body;
    if (!content || !contentType) {
      return res.status(400).json({ error: 'Content and contentType are required' });
    }
    const result = await assessSafety({
      content,
      contentType: contentType as 'text' | 'url' | 'image'
    });
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Safety assessment failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Safety assessment service unavailable',
      message: 'Unable to assess content safety at this time',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/verify-source', async (req: Request, res: Response) => {
  try {
    const { content, contentType } = req.body;
    if (!content || !contentType) {
      return res.status(400).json({ error: 'Content and contentType are required' });
    }
    const result = await verifySource({
      content,
      contentType: contentType as 'text' | 'url'
    });
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Source verification failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Source verification service unavailable',
      message: 'Unable to verify source credibility at this time',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/web-analysis', async (req: Request, res: Response) => {
  try {
    const { query, contentType, searchEngineId } = req.body;
    if (!query || !contentType) {
      return res.status(400).json({ error: 'Query and contentType are required' });
    }
    const result = await performWebAnalysis({
      query,
      contentType: contentType as 'text' | 'url',
      searchEngineId
    });
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Web analysis failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Web analysis service unavailable',
      message: 'Unable to analyze web content at this time',
      timestamp: new Date().toISOString()
    });
  }
});


app.post('/api/safe-search', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const result = await safeSearchUrl({ url });
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Safe search failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Safe search service unavailable',
      message: 'Unable to verify URL safety at this time',
      timestamp: new Date().toISOString()
    });
  }
});
app.post('/api/translate-text', async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'Text and targetLanguage are required' });
    }
    const result = await translateTextFlow({ text, targetLanguage });
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Translation failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Translation service unavailable',
      message: 'Unable to translate text at this time',
      timestamp: new Date().toISOString()
    });
  }
});



// Fallback for unknown routes - ensure JSON response
app.use((req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler to always return JSON (including parser errors)
// Must have 4 args to be recognized by Express as error middleware
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const anyErr = err as any;
  if (anyErr?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: `Request entity too large. Max allowed: ${REQUEST_SIZE_LIMIT}`,
      timestamp: new Date().toISOString(),
    });
  }
  if (err instanceof SyntaxError && 'body' in (err as any)) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: (err as SyntaxError).message,
      timestamp: new Date().toISOString(),
    });
  }
  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
  console.error(`Unhandled error: ${errorMessage}`);
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`✅ unmai.ai backend running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  }
});

// Handle server startup errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Try: lsof -ti:${PORT} | xargs kill -9`);
    }
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`Permission denied for port ${PORT}`);
    process.exit(1);
  } else {
    console.error(`Server startup error: ${error.message || error}`);
    process.exit(1);
  }
});

// Graceful shutdown handling
const shutdown = (signal: string) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\nShutting down (${signal})...`);
  }

  server.close((err?: Error) => {
    if (err) {
      console.error(`Shutdown error: ${err.message}`);
      process.exit(1);
    }
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    process.exit(1);
  }, 10000);
};

// Handle different termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Fatal error: ${errorMessage}`);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: unknown) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  console.error(`Unhandled rejection: ${errorMessage}`);
  shutdown('UNHANDLED_REJECTION');
});
