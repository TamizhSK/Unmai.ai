import crypto from 'crypto';
import { usersCol, analysisCol } from './firestore.js';

const JWT_SECRET = process.env.JWT_SECRET || 'unmai-dev-secret-please-set-in-production';
const TOKEN_EXPIRY_SECS = 7 * 24 * 60 * 60; // 7 days

// ── JWT helpers (pure crypto, no extra deps) ─────────────────────────────────

function issueToken(uid: string, email: string): string {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    uid,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export function verifyToken(token: string): { uid: string; email: string } {
  const [header, payload, sig] = token.split('.');
  if (!header || !payload || !sig) throw new Error('Malformed token');

  const expected = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  if (sig !== expected) throw new Error('Invalid token signature');

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

  return { uid: data.uid, email: data.email };
}

// ── Password hashing (PBKDF2) ─────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) =>
    crypto.pbkdf2(password, salt, 100_000, 64, 'sha512', (err, key) =>
      err ? reject(err) : resolve(`${salt}:${key.toString('hex')}`)
    )
  );
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':');
  return new Promise((resolve, reject) =>
    crypto.pbkdf2(password, salt, 100_000, 64, 'sha512', (err, derived) =>
      err ? reject(err) : resolve(derived.toString('hex') === key)
    )
  );
}

// ── Public auth operations ────────────────────────────────────────────────────

export async function createUser(email: string, password: string, displayName: string) {
  const existing = await usersCol.where('email', '==', email.toLowerCase()).limit(1).get();
  if (!existing.empty) throw new Error('Email already in use');

  const uid = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await usersCol.doc(uid).set({
    uid,
    email: email.toLowerCase(),
    displayName,
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  const token = issueToken(uid, email.toLowerCase());
  return { token, user: { uid, email: email.toLowerCase(), displayName } };
}

export async function loginUser(email: string, password: string) {
  const snapshot = await usersCol.where('email', '==', email.toLowerCase()).limit(1).get();
  if (snapshot.empty) throw new Error('Invalid email or password');

  const data = snapshot.docs[0].data();
  const valid = await verifyPassword(password, data.passwordHash);
  if (!valid) throw new Error('Invalid email or password');

  const token = issueToken(data.uid, data.email);
  return { token, user: { uid: data.uid, email: data.email, displayName: data.displayName } };
}

export async function getUserById(uid: string) {
  const doc = await usersCol.doc(uid).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return { uid: d.uid, email: d.email, displayName: d.displayName };
}

// ── Analysis history ──────────────────────────────────────────────────────────

export async function saveAnalysis(uid: string, type: string, inputSummary: string, result: any) {
  const id = crypto.randomUUID();
  await analysisCol.doc(id).set({
    id,
    uid,
    type,
    inputSummary: inputSummary.slice(0, 200),
    oneLineDescription: ((result?.oneLineDescription || inputSummary || type) as string).slice(0, 200),
    verdict: result?.verdict ?? 'unknown',
    trustScore: result?.trustScore ?? 0,
    createdAt: new Date().toISOString(),
  });
}

export async function getUserHistory(uid: string, limit = 20) {
  const snapshot = await analysisCol
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map(d => d.data());
}
