/**
 * Local-only accounts. Nothing is sent to a server: accounts live in this browser's localStorage,
 * passwords are stored only as salted PBKDF2-SHA-256 hashes (Web Crypto), and the session lives in
 * sessionStorage, so it ends when the tab is closed.
 *
 * Threat model: stops another person on a shared computer from opening the shop's customer data.
 * It does not protect against someone with full control of the device (no local app can).
 */

export interface StoredUser {
  username: string;
  salt: string; // base64
  hash: string; // base64
  iterations: number;
  createdAt: string;
}

export interface Session {
  username: string;
  expiresAt: number;
}

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const USERS_KEY = 'kroypulse.users.v1';
const SESSION_KEY = 'kroypulse.session.v1';
const LOCK_KEY = 'kroypulse.lock.v1';
export const ITERATIONS = 600_000; // OWASP 2023 recommendation for PBKDF2-HMAC-SHA256
export const SESSION_MS = 8 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 60 * 1000;

const enc = new TextEncoder();
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const defaultLocal = (): KV => globalThis.localStorage;
const defaultSession = (): KV => globalThis.sessionStorage;

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

function equalConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function normaliseUsername(u: string): string {
  return u.trim().toLowerCase();
}

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(pw: string, username = ''): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use both letters and numbers.';
  if (username && pw.toLowerCase().includes(normaliseUsername(username))) return 'The password must not contain the username.';
  return null;
}

export function listUsers(store: KV = defaultLocal()): StoredUser[] {
  try {
    const v = JSON.parse(store.getItem(USERS_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function hasAnyUser(store: KV = defaultLocal()): boolean {
  return listUsers(store).length > 0;
}

/**
 * Create an account. The first account can be created by anyone (first run on this device);
 * after that only a signed-in user can add staff accounts.
 */
export async function register(username: string, password: string, store: KV = defaultLocal(), sessionStore: KV = defaultSession()): Promise<void> {
  const name = normaliseUsername(username);
  if (!/^[a-z0-9._-]{3,32}$/.test(name)) throw new Error('Username: 3–32 letters, numbers, dot, dash or underscore.');
  const problem = passwordProblem(password, name);
  if (problem) throw new Error(problem);
  const users = listUsers(store);
  if (users.length > 0 && !currentSession(sessionStore)) throw new Error('Only a signed-in user can add another account.');
  if (users.some((u) => u.username === name)) throw new Error('That username already exists.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  users.push({ username: name, salt: toB64(salt), hash: toB64(hash), iterations: ITERATIONS, createdAt: new Date().toISOString() });
  store.setItem(USERS_KEY, JSON.stringify(users));
}

export function lockoutRemainingMs(store: KV = defaultLocal(), now = Date.now()): number {
  try {
    const { until = 0 } = JSON.parse(store.getItem(LOCK_KEY) || '{}');
    return Math.max(0, until - now);
  } catch {
    return 0;
  }
}

export async function login(username: string, password: string, store: KV = defaultLocal(), sessionStore: KV = defaultSession(), now = Date.now()): Promise<Session> {
  const wait = lockoutRemainingMs(store, now);
  if (wait > 0) throw new Error(`Too many attempts. Try again in ${Math.ceil(wait / 1000)} s.`);

  const name = normaliseUsername(username);
  const user = listUsers(store).find((u) => u.username === name);
  // Hash even for unknown users so response time does not reveal which usernames exist.
  const salt = user ? fromB64(user.salt) : new Uint8Array(16);
  const hash = await derive(password, salt, user?.iterations ?? ITERATIONS);
  if (!user || !equalConstantTime(hash, fromB64(user.hash))) {
    let state = { fails: 0, until: 0 };
    try { state = { ...state, ...JSON.parse(store.getItem(LOCK_KEY) || '{}') }; } catch { /* corrupt lock record: start over */ }
    const fails = state.fails + 1;
    store.setItem(LOCK_KEY, JSON.stringify(fails >= MAX_ATTEMPTS ? { fails: 0, until: now + LOCKOUT_MS } : { fails, until: 0 }));
    throw new Error('Wrong username or password.');
  }
  store.removeItem(LOCK_KEY);
  const session = { username: name, expiresAt: now + SESSION_MS };
  sessionStore.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function currentSession(sessionStore: KV = defaultSession(), now = Date.now()): Session | null {
  try {
    const s = JSON.parse(sessionStore.getItem(SESSION_KEY) || 'null') as Session | null;
    if (s && typeof s.username === 'string' && s.expiresAt > now) return s;
  } catch { /* fall through */ }
  sessionStore.removeItem(SESSION_KEY);
  return null;
}

export function logout(sessionStore: KV = defaultSession()): void {
  sessionStore.removeItem(SESSION_KEY);
}
