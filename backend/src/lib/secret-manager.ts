/**
 * Google Cloud Secret Manager Service
 * 
 * Primary source for secrets in both development and production.
 * Falls back to environment variables only if Secret Manager is unavailable.
 * 
 * Usage:
 *   const secret = await secretManager.getSecret('JWT_SECRET');
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { config } from 'dotenv';

// Load .env for fallback values only
config();

interface SecretCache {
  value: string;
  timestamp: number;
  ttl: number;
}

class SecretManagerService {
  private static instance: SecretManagerService;
  private client: SecretManagerServiceClient | null = null;
  private cache: Map<string, SecretCache> = new Map();
  private initialized = false;
  private projectId: string | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): SecretManagerService {
    if (!SecretManagerService.instance) {
      SecretManagerService.instance = new SecretManagerService();
    }
    return SecretManagerService.instance;
  }

  /**
   * Initialize the Secret Manager client
   * Only runs once during application startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Get project ID from environment
      this.projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null;

      if (!this.projectId) {
        console.log('[SecretManager] No GCP project ID configured, using environment fallback');
        this.initialized = true;
        return;
      }

      // Initialize the client
      this.client = new SecretManagerServiceClient({
        projectId: this.projectId,
      });

      this.initialized = true;
      console.log('[SecretManager] Initialized for project:', this.projectId);
    } catch (error) {
      console.warn('[SecretManager] Initialization failed, using environment fallback:', 
        error instanceof Error ? error.message : 'Unknown error');
      this.initialized = true;
    }
  }

  /**
   * Get a secret value by name
   * 
   * Flow:
   * 1. Check cache first
   * 2. Try Secret Manager
   * 3. Fallback to environment variable
   * 4. Return null if not found
   * 
   * @param secretName - Name of the secret (e.g., 'JWT_SECRET', 'GEMINI_API_KEY')
   * @param options - Optional configuration
   * @returns The secret value or null if not found
   */
  async getSecret(
    secretName: string, 
    options: { useCache?: boolean; ttl?: number } = {}
  ): Promise<string | null> {
    const { useCache = true, ttl = 3600000 } = options; // Default TTL: 1 hour

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(secretName);
      if (cached && Date.now() < cached.timestamp + cached.ttl) {
        return cached.value;
      }
    }

    // Try Secret Manager
    if (this.client && this.projectId) {
      try {
        const [version] = await this.client.accessSecretVersion({
          name: `projects/${this.projectId}/secrets/${secretName}/versions/latest`,
        });

        const secretValue = version.payload?.data?.toString();
        if (secretValue) {
          // Cache the result
          this.cache.set(secretName, {
            value: secretValue,
            timestamp: Date.now(),
            ttl,
          });

          console.log(`[SecretManager] Loaded secret: ${secretName}`);
          return secretValue;
        }
      } catch (error) {
        // Log only if it's not a "not found" error
        if (!this.isNotFoundError(error)) {
          console.warn(`[SecretManager] Failed to load '${secretName}':`, 
            error instanceof Error ? error.message : 'Unknown error');
        }
        // Continue to fallback
      }
    }

    // Fallback to environment variable
    const envValue = process.env[secretName];
    if (envValue) {
      console.log(`[SecretManager] Using environment fallback for: ${secretName}`);
      
      // Cache environment values too
      if (useCache) {
        this.cache.set(secretName, {
          value: envValue,
          timestamp: Date.now(),
          ttl,
        });
      }
      
      return envValue;
    }

    return null;
  }

  /**
   * Get multiple secrets at once
   * 
   * @param secretNames - Array of secret names
   * @returns Object with secret names as keys and values (or null) as values
   */
  async getSecrets(secretNames: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    
    await Promise.all(
      secretNames.map(async (name) => {
        results[name] = await this.getSecret(name);
      })
    );

    return results;
  }

  /**
   * Check if Secret Manager is available
   */
  isAvailable(): boolean {
    return this.client !== null && this.projectId !== null;
  }

  /**
   * Clear the cache for a specific secret
   */
  invalidateCache(secretName: string): void {
    this.cache.delete(secretName);
  }

  /**
   * Clear all cached secrets
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if error is a "not found" error
   */
  private isNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('NOT_FOUND') || 
             error.message.includes('not found') ||
             error.message.includes('Secret not found');
    }
    return false;
  }
}

// Export singleton instance
export const secretManager = SecretManagerService.getInstance();

// Auto-initialize on import (runs only once due to singleton)
secretManager.initialize().catch(error => {
  console.error('[SecretManager] Auto-initialization failed:', error);
});

export default secretManager;
