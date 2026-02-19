// Load secure environment (JWT, Google Secrets, or .env fallback)
import secureEnv from '../lib/secure-env.js';

// Ensure environment is loaded and validated
await secureEnv.load();
// Skip validation for prototype mode - GCP not required when using Gemini API only
// if (!secureEnv.validate()) {
//   throw new Error('Required environment variables are missing or invalid');
// }

// Get project ID (optional for prototype)
export function getProjectId(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
        // Return a dummy project ID for prototype mode
        console.warn('[WARN] GCP_PROJECT_ID not set - using prototype mode');
        return 'prototype-project';
    }
    return projectId;
}

// Create auth configuration that works with Google Cloud clients
export function getAuthConfig() {
    return {
        projectId: getProjectId(),
        // Let the clients use Application Default Credentials automatically
        // This avoids the getUniverseDomain issue
    };
}