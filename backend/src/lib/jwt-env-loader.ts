/**
 * JWT Environment Loader for Backend (ES Module Compatible)
 * Handles secure loading of environment variables with JWT tokens
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface JWTPayload {
  data: Record<string, string>;
  iat: number;
  exp: number;
}

class JWTEnvironmentLoader {
  private static instance: JWTEnvironmentLoader;
  private loaded = false;

  static getInstance(): JWTEnvironmentLoader {
    if (!JWTEnvironmentLoader.instance) {
      JWTEnvironmentLoader.instance = new JWTEnvironmentLoader();
    }
    return JWTEnvironmentLoader.instance;
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
      throw new Error(`Failed to decode JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private findProjectRoot(): string {
    // Get current file directory in ES module context
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    let currentDir = __dirname;
    
    // Go up directories until we find package.json
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        const packageJson = JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf8'));
        // Look for the root package.json (has workspaces or is named 'unmai')
        if (packageJson.workspaces || packageJson.name === 'unmai') {
          return currentDir;
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    // Fallback to current working directory
    return process.cwd();
  }

  async loadEnvironment(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const projectRoot = this.findProjectRoot();
      const jwtEnvPath = path.join(projectRoot, '.env.jwt');
      const secretPath = path.join(projectRoot, '.env.secret');

      // Check if JWT environment files exist
      if (!fs.existsSync(jwtEnvPath) || !fs.existsSync(secretPath)) {
        console.log('[INFO] JWT environment files not found, using dotenv fallback');
        
        // Try to load dotenv dynamically
        try {
          const { config } = await import('dotenv');
          config({ path: path.join(projectRoot, '.env') });
        } catch (dotenvError) {
          console.log('[INFO] dotenv not available, using environment variables only');
        }
        
        this.loaded = true;
        return;
      }

      // Load secret
      const secret = fs.readFileSync(secretPath, 'utf8').trim();
      const jwtEnvContent = fs.readFileSync(jwtEnvPath, 'utf8');

      // Parse regular environment variables
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
        
        // Set sensitive environment variables
        if (payload.data) {
          Object.entries(payload.data).forEach(([key, value]) => {
            if (!process.env[key]) {
              process.env[key] = value;
            }
          });
        }
      }

      console.log('[INFO] JWT environment loaded successfully');
      this.loaded = true;
    } catch (error) {
      console.error(`[ERROR] Failed to load JWT environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('[INFO] Falling back to regular .env file');
      
      // Fallback to regular dotenv
      try {
        const { config } = await import('dotenv');
        config();
        this.loaded = true;
      } catch (dotenvError) {
        console.log('[INFO] dotenv not available, using environment variables only');
        this.loaded = true;
      }
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // Validate required environment variables
  validateRequiredVars(requiredVars: string[]): boolean {
    const missing: string[] = [];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      console.error(`[ERROR] Missing required environment variables: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const jwtEnvLoader = JWTEnvironmentLoader.getInstance();

// Export for manual loading
export async function loadJWTEnvironment(): Promise<void> {
  await jwtEnvLoader.loadEnvironment();
}

export function validateEnvironment(requiredVars: string[] = ['GCP_PROJECT_ID', 'GEMINI_API_KEY']): boolean {
  return jwtEnvLoader.validateRequiredVars(requiredVars);
}

// Auto-load environment on import (async)
loadJWTEnvironment().catch(error => {
  console.error('[ERROR] Failed to auto-load JWT environment:', error);
});