/**
 * Secure Environment Loader for Production
 * Handles JWT tokens, Google Cloud secrets, and fallback to regular env
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface SecureEnvConfig {
  required: string[];
  optional: string[];
  jwtSecret?: string;
}

interface JWTPayload {
  data: Record<string, string>;
  iat: number;
  exp: number;
}

class SecureEnvironment {
  private static instance: SecureEnvironment;
  private loaded = false;
  private config: SecureEnvConfig;

  constructor(config: SecureEnvConfig = { required: [], optional: [] }) {
    this.config = config;
  }

  static getInstance(config?: SecureEnvConfig): SecureEnvironment {
    if (!SecureEnvironment.instance) {
      SecureEnvironment.instance = new SecureEnvironment(config);
    }
    return SecureEnvironment.instance;
  }

  private findProjectRoot(): string {
    let currentDir = process.cwd();
    
    // Look for package.json to identify project root
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        const packageJson = JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf8'));
        if (packageJson.name === 'unmai' || packageJson.workspaces) {
          return currentDir;
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    return process.cwd();
  }

  private decodeJWTToken(token: string, secret: string): JWTPayload {
    try {
      const [encodedHeader, encodedPayload, signature] = token.split('.');
      
      if (!encodedHeader || !encodedPayload || !signature) {
        throw new Error('Invalid JWT token format');
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');

      if (signature !== expectedSignature) {
        throw new Error('Invalid JWT signature');
      }

      // Decode payload
      const payload: JWTPayload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString()
      );

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('JWT token has expired');
      }

      return payload;
    } catch (error) {
      throw new Error(`JWT decode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadFromGoogleSecrets(): Promise<boolean> {
    try {
      // Skip Google Cloud authentication in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('[INFO] Development mode - skipping Google Cloud Secret Manager');
        return false;
      }

      // Check if we're in Google Cloud environment
      if (!process.env.GOOGLE_CLOUD_PROJECT && !process.env.GCP_PROJECT_ID) {
        return false;
      }

      // Try to load from Google Secret Manager
      const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
      const client = new SecretManagerServiceClient();

      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;

      // Load GEMINI_API_KEY from secrets
      if (!process.env.GEMINI_API_KEY) {
        try {
          const [version] = await client.accessSecretVersion({
            name: `projects/${projectId}/secrets/gemini-api-key/versions/latest`,
          });

          const secretValue = version.payload?.data?.toString();
          if (secretValue) {
            process.env.GEMINI_API_KEY = secretValue;
            console.log('[INFO] Loaded GEMINI_API_KEY from Google Secret Manager');
          }
        } catch (error) {
          console.warn('[WARN] Could not load GEMINI_API_KEY from Secret Manager:', error);
        }
      }

      // Load optional secrets
      if (!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY) {
        try {
          const [version] = await client.accessSecretVersion({
            name: `projects/${projectId}/secrets/google-custom-search-api-key/versions/latest`,
          });

          const secretValue = version.payload?.data?.toString();
          if (secretValue) {
            process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = secretValue;
            console.log('[INFO] Loaded GOOGLE_CUSTOM_SEARCH_API_KEY from Google Secret Manager');
          }
        } catch (error) {
          console.log('[INFO] GOOGLE_CUSTOM_SEARCH_API_KEY not found in Secret Manager (optional)');
        }
      }

      return true;
    } catch (error) {
      console.warn('[WARN] Google Secret Manager not available:', error);
      return false;
    }
  }

  private loadFromJWT(): boolean {
    try {
      const projectRoot = this.findProjectRoot();
      const jwtEnvPath = path.join(projectRoot, '.env.jwt');
      const secretPath = path.join(projectRoot, '.env.secret');

      if (!fs.existsSync(jwtEnvPath) || !fs.existsSync(secretPath)) {
        return false;
      }

      const secret = fs.readFileSync(secretPath, 'utf8').trim();
      const jwtEnvContent = fs.readFileSync(jwtEnvPath, 'utf8');

      // Load regular environment variables
      const envLines = jwtEnvContent.split('\n');
      for (const line of envLines) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0 && key.trim() !== 'JWT_ENV_TOKEN') {
          const value = valueParts.join('=').trim();
          if (value && !process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      }

      // Decode JWT token for sensitive variables
      const jwtTokenMatch = jwtEnvContent.match(/JWT_ENV_TOKEN=(.+)/);
      if (jwtTokenMatch) {
        const payload = this.decodeJWTToken(jwtTokenMatch[1], secret);
        
        if (payload.data) {
          Object.entries(payload.data).forEach(([key, value]) => {
            if (!process.env[key]) {
              process.env[key] = value;
            }
          });
        }
      }

      console.log('[INFO] JWT environment loaded successfully');
      return true;
    } catch (error) {
      console.warn('[WARN] JWT environment loading failed:', error);
      return false;
    }
  }

  private async loadFromDotenv(): Promise<boolean> {
    try {
      const projectRoot = this.findProjectRoot();
      const envPath = path.join(projectRoot, '.env');
      
      const { config } = await import('dotenv');

      if (fs.existsSync(envPath)) {
        config({ path: envPath });
        console.log('[INFO] Loaded environment from .env file');
        return true;
      }
      
      // Try loading from current directory
      config();
      console.log('[INFO] Loaded environment from default .env');
      return true;
    } catch (error) {
      console.error('[ERROR] Failed to load .env file:', error);
      return false;
    }
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    // Try loading in order of preference:
    // 1. Google Cloud Secret Manager (production)
    // 2. JWT environment files (secure local/staging)
    // 3. Regular .env files (development fallback)

    let loaded = false;

    // Google Cloud secrets (enabled for production)
    if (await this.loadFromGoogleSecrets()) {
      loaded = true;
    }

    // Try JWT environment (secure local/staging)
    if (!loaded && this.loadFromJWT()) {
      loaded = true;
    }

    // Fallback to regular .env (development)
    if (!loaded) {
      await this.loadFromDotenv();
    }

    this.loaded = true;
  }

  validate(): boolean {
    const missing: string[] = [];
    
    for (const varName of this.config.required) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      console.error(`[ERROR] Missing required environment variables: ${missing.join(', ')}`);
      return false;
    }

    // Validate API key format
    if (process.env.GEMINI_API_KEY) {
      const apiKeyPattern = /^AIza[0-9A-Za-z_-]{35}$/;
      if (!apiKeyPattern.test(process.env.GEMINI_API_KEY)) {
        console.warn('[WARN] GEMINI_API_KEY format may be invalid');
      }
    }

    console.log('[INFO] Environment validation passed');
    return true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

// Create and export singleton instance with GCP enabled
const secureEnv = SecureEnvironment.getInstance({
  required: ['GCP_PROJECT_ID', 'GCP_LOCATION', 'GEMINI_API_KEY'],
  optional: ['GOOGLE_CUSTOM_SEARCH_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID', 'GOOGLE_CLOUD_PROJECT']
});

// Auto-load environment
secureEnv.load().catch(error => {
  console.error('[ERROR] Failed to load secure environment:', error);
});

export { secureEnv };
export default secureEnv;