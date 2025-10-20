import { config } from 'dotenv';
// Load environment variables
config();
// Get project ID
export function getProjectId() {
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
//# sourceMappingURL=auth.js.map