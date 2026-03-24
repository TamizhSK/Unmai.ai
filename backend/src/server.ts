import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createUser, loginUser, getUserById, saveAnalysis, getUserHistory, verifyToken } from './lib/auth-service.js';
import { environmentInitializer } from './lib/environment-initializer.js';

// CRITICAL: Initialize environment ONCE at application startup
// This is the ONLY place where environment loading should happen
await environmentInitializer.initialize();

// Now import flows (environment is already loaded)
import { factCheckClaim } from './ai/flows/fact-check-claim.js';
import { getCredibilityScore } from './ai/flows/get-credibility-score.js';
import { detectDeepfake } from './ai/flows/detect-deepfake.js';
import { analyzeUnified } from './ai/flows/unified-analysis.js';
import { assessSafety } from './ai/flows/safety-assessment.js';
import { verifySource } from './ai/flows/verify-source.js';
import { performWebAnalysis } from './ai/flows/perform-web-analysis.js';
import { safeSearchUrl } from './ai/flows/safe-search-url.js';
import { translateTextFlow } from './ai/flows/translate-text.js';

// Log GCP configuration (minimal, production-ready logging)
console.log(`[Server] GCP Project: ${process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT}`);
console.log(`[Server] Vision API: Available via ADC`);
console.log(`[Server] Video Intelligence API: Available via ADC`);

const app = express();
const PORT = process.env.PORT || 3001;
const REQUEST_SIZE_LIMIT = process.env.REQUEST_SIZE_LIMIT || '50mb';

// Production-ready CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

// In production, also allow the Cloud Run domain
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push('https://unmai-ai.run.place', 'https://www.unmai-ai.run.place');
}

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Allow all for now, but log
          console.warn(`[CORS] Request from unlisted origin: ${origin}`);
        }
      }
    : true, // Allow all in development
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

// Security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Simple rate limiter (per IP, per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '60'); // requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute

app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip rate limiting for health checks
  if (req.path === '/health' || req.path === '/health/detailed') return next();

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }
  next();
});

// Clean up rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300000);

// Request timeout (3 minutes for AI analysis, 30s otherwise)
app.use((req: Request, res: Response, next: NextFunction) => {
  const timeout = req.path.includes('/analyze') ? 180000 : 30000;
  req.setTimeout(timeout);
  res.setTimeout(timeout);
  next();
});

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

// Streaming endpoint for real-time analysis (Server-Sent Events)
app.post('/api/analyze/stream', async (req: Request, res: Response) => {
  try {
    const { type, payload, searchEngineId } = req.body || {};
    if (!type || !payload) {
      return res.status(400).json({ error: 'type and payload are required' });
    }
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Send initial connection event
    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    const startTime = Date.now();
    const emit = (stage: string, message: string, expectedChecks?: string[]) => {
      const elapsed = Date.now() - startTime;
      res.write(`event: progress\ndata: ${JSON.stringify({ stage, message, elapsed, expectedChecks })}\n\n`);
    };

    // Ordered stage names matching frontend LOADER_STAGES
    const STAGE_SEQUENCE = [
      { stage: 'detecting',    message: 'Detecting input type...' },
      { stage: 'extracting',   message: 'Extracting content from input...' },
      { stage: 'claims',       message: 'Identifying factual claims...' },
      { stage: 'queries',      message: 'Generating search queries...' },
      { stage: 'evidence',     message: 'Searching fact-check databases & sources...' },
      { stage: 'ranking',      message: 'Ranking source credibility...' },
      { stage: 'reasoning',    message: 'AI analyzing evidence...' },
      { stage: 'explanation',  message: 'Generating explanation...' },
      { stage: 'complete',     message: 'Preparing verification report...' },
    ];

    // Emit first two stages immediately so UI updates fast
    emit(STAGE_SEQUENCE[0].stage, STAGE_SEQUENCE[0].message, STAGE_SEQUENCE.map(s => s.message));
    setTimeout(() => emit(STAGE_SEQUENCE[1].stage, STAGE_SEQUENCE[1].message), 800);

    // For input types that are known to be slower, emit intermediate stages during analysis
    const isMedia = ['image', 'video', 'audio'].includes(type);
    const stageDurations = isMedia
      ? [0, 800, 2500, 5000, 8000, 11000, 14000, 17000]
      : [0, 800, 1800, 3000, 5000, 7000, 9000, 11000];
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 2; i < STAGE_SEQUENCE.length - 1; i++) {
      const s = STAGE_SEQUENCE[i];
      const timer = setTimeout(() => emit(s.stage, s.message), stageDurations[i] ?? stageDurations[stageDurations.length - 1]);
      stageTimers.push(timer);
    }

    try {
      // Perform the analysis
      const result = await analyzeUnified({ type, payload } as any, { searchEngineId });

      // Clear pending timers — real result arrived
      stageTimers.forEach(t => clearTimeout(t));

      // Emit complete stage then result
      emit(STAGE_SEQUENCE[STAGE_SEQUENCE.length - 1].stage, STAGE_SEQUENCE[STAGE_SEQUENCE.length - 1].message);
      res.write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
      res.write('event: done\ndata: {"status":"complete"}\n\n');
      res.end();

      // Persist to Firestore for authenticated users (fire-and-forget)
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        try {
          const { uid } = verifyToken(auth.slice(7));
          const summary = (payload as any)?.text?.slice(0, 200) ?? (payload as any)?.url ?? type;
          saveAnalysis(uid, type, summary, result).catch(() => {});
        } catch { /* unauthenticated or invalid token — skip */ }
      }
    } catch (error) {
      stageTimers.forEach(t => clearTimeout(t));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Unified analyze stream failed: ${errorMessage}`);
      res.write(`event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Stream endpoint failed: ${errorMessage}`);
    
    // Send error event
    res.write(`event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
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
      gcpProject: !!(process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT),
      searchService: {
        configured: true,
        method: 'Multi-source (Fact Check + Knowledge Graph + Wikipedia + News)'
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

app.post('/api/translate-batch', async (req: Request, res: Response) => {
  try {
    const { texts, targetLanguage } = req.body;
    if (!Array.isArray(texts) || !targetLanguage) {
      return res.status(400).json({ error: 'texts (array) and targetLanguage are required' });
    }
    // Translate all texts in parallel, falling back to original on individual failure
    const translations = await Promise.all(
      texts.map(async (text: string) => {
        if (!text || typeof text !== 'string') return text;
        try {
          const result = await translateTextFlow({ text: text.trim(), targetLanguage });
          return typeof result === 'string' ? result : text;
        } catch {
          return text; // fallback to original
        }
      })
    );
    res.json({ translations });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Batch translation failed: ${errorMessage}`);
    res.status(500).json({
      error: 'Batch translation service unavailable',
      message: 'Unable to translate texts at this time',
      timestamp: new Date().toISOString()
    });
  }
});



// ── Auth endpoints ────────────────────────────────────────────────────────────

app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'email, password, and displayName are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const result = await createUser(email, password, displayName);
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Signup failed';
    res.status(msg === 'Email already in use' ? 409 : 500).json({ error: msg });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const result = await loginUser(email, password);
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Login failed';
    res.status(msg === 'Invalid email or password' ? 401 : 500).json({ error: msg });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  // Stateless JWT — client clears token; no server-side invalidation needed
  res.json({ success: true });
});

// ── User endpoints ────────────────────────────────────────────────────────────

function extractUid(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return verifyToken(auth.slice(7)).uid;
  } catch {
    return null;
  }
}

app.get('/api/user/profile', async (req: Request, res: Response) => {
  const uid = extractUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const user = await getUserById(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.get('/api/user/history', async (req: Request, res: Response) => {
  const uid = extractUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '20'), 50);
    const history = await getUserHistory(uid, limit);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load history' });
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
