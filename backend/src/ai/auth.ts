// Load secure environment (JWT, Google Secrets, or .env fallback)
import secureEnv from '../lib/secure-env.js';

// Ensure environment is loaded and validated
await secureEnv.load();

// Get project ID
export function getProjectId(): string {
    const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
        throw new Error('GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable is required');
    }
    return projectId;
}

// Get GCP location
export function getLocation(): string {
    return process.env.GCP_LOCATION || 'us-central1';
}

// Create auth configuration for Google Cloud clients
export function getAuthConfig() {
    return {
        projectId: getProjectId(),
        // Application Default Credentials (ADC) are used automatically
        // This works with gcloud auth application-default login
    };
}