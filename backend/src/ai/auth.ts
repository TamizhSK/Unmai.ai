// Load secure environment (JWT, Google Secrets, or .env fallback)
import secureEnv from '../lib/secure-env.js';

// Ensure environment is loaded and validated
await secureEnv.load();
if (!secureEnv.validate()) {
  throw new Error('Required environment variables are missing or invalid');
}

// Get project ID
export function getProjectId(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
        throw new Error('GCP_PROJECT_ID environment variable is required');
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