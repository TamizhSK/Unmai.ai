import { Firestore } from '@google-cloud/firestore';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const databaseId = process.env.FIRESTORE_DATABASE_ID || 'unmai-ai-2025';

if (!projectId) {
  throw new Error('GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required for Firestore');
}

export const db = new Firestore({ projectId, databaseId });

// Collections
export const usersCol = db.collection('users');
export const analysisCol = db.collection('analysis');

console.log(`[INFO] Firestore initialized — project: ${projectId}, database: ${databaseId}`);
