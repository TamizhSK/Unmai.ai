/**
 * Unified Environment Initializer
 * 
 * Singleton service that loads and validates environment configuration.
 * Runs exactly once during application startup.
 * 
 * Usage:
 *   await environmentInitializer.initialize();
 */

import { config } from 'dotenv';
import { secretManager } from './secret-manager.js';

interface EnvironmentConfig {
  required: string[];
  optional: string[];
}

class EnvironmentInitializer {
  private static instance: EnvironmentInitializer;
  private initialized = false;
  private config: EnvironmentConfig;

  private constructor(config?: EnvironmentConfig) {
    this.config = config || {
      required: ['GCP_PROJECT_ID', 'GEMINI_API_KEY'],
      optional: [
        'GCP_LOCATION',
        'GOOGLE_API_KEY',
        'VERTEX_AI_TEXT_MODEL',
        'VERTEX_AI_VISION_MODEL',
        'PORT',
        'JWT_SECRET',
        'DATABASE_URL',
      ],
    };
  }

  static getInstance(config?: EnvironmentConfig): EnvironmentInitializer {
    if (!EnvironmentInitializer.instance) {
      EnvironmentInitializer.instance = new EnvironmentInitializer(config);
    }
    return EnvironmentInitializer.instance;
  }

  /**
   * Initialize environment exactly once
   * This is the ONLY place where dotenv should be loaded
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[Environment] Initializing...');

    // Step 1: Load .env file (only once, here)
    config();

    // Step 2: Load secrets from Secret Manager (with fallback to .env)
    const secrets = await secretManager.getSecrets([
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'JWT_SECRET',
      'DATABASE_URL',
    ]);

    // Apply secrets to process.env
    Object.entries(secrets).forEach(([key, value]) => {
      if (value && !process.env[key]) {
        process.env[key] = value;
      }
    });

    // Step 3: Validate required variables
    const missing = this.config.required.filter(
      (varName) => !process.env[varName] && !process.env[this.getAlternativeVar(varName)]
    );

    if (missing.length > 0) {
      console.error(`[Environment] Missing required variables: ${missing.join(', ')}`);
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Step 4: Set defaults for optional variables
    this.setDefaults();

    this.initialized = true;
    console.log('[Environment] Initialized successfully');
    console.log(`[Environment] Project: ${process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT}`);
    console.log(`[Environment] Secrets Manager: ${secretManager.isAvailable() ? 'Active' : 'Fallback mode'}`);
  }

  /**
   * Check if environment is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get a required environment variable
   * Throws error if not found
   */
  getRequired(name: string): string {
    const value = process.env[name] || process.env[this.getAlternativeVar(name)];
    
    if (!value) {
      throw new Error(`Required environment variable not found: ${name}`);
    }
    
    return value;
  }

  /**
   * Get an optional environment variable with default
   */
  getOptional(name: string, defaultValue: string): string {
    return process.env[name] || defaultValue;
  }

  /**
   * Set default values for optional variables
   */
  private setDefaults(): void {
    const defaults: Record<string, string> = {
      GCP_LOCATION: 'us-central1',
      VERTEX_AI_TEXT_MODEL: 'gemini-2.5-pro',
      VERTEX_AI_VISION_MODEL: 'gemini-2.5-pro',
      PORT: '3001',
      NODE_ENV: 'development',
    };

    Object.entries(defaults).forEach(([key, value]) => {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  }

  /**
   * Get alternative variable name (for backward compatibility)
   */
  private getAlternativeVar(name: string): string {
    const alternatives: Record<string, string> = {
      GCP_PROJECT_ID: 'GOOGLE_CLOUD_PROJECT',
      GOOGLE_CLOUD_PROJECT: 'GCP_PROJECT_ID',
    };
    return alternatives[name] || '';
  }
}

// Export singleton instance
export const environmentInitializer = EnvironmentInitializer.getInstance();

export default environmentInitializer;
