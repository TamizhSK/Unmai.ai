#!/usr/bin/env node
// ES Module wrapper for the CommonJS server launcher
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JWT environment if available
try {
  const { loadJWTEnvironment } = await import('../scripts/load-jwt-env.js');
  loadJWTEnvironment();
} catch (error) {
  console.log('[INFO] JWT environment not available, using regular environment');
}

// Start the server using tsx
const serverPath = join(__dirname, '..', 'src', 'server.ts');
const child = spawn('npx', ['tsx', serverPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
