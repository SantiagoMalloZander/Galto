import crypto from 'crypto';

export const ADMIN_COOKIE = 'galto_admin_session';

const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ?? 'change-this-admin-session-secret';

type AdminCredential = {
  email: string;
  password: string;
};

const DEFAULT_ADMIN_CREDENTIALS: AdminCredential[] = [
  { email: 'mzanderconsulting@gmail.com', password: 'Mor410@siempre' },
  { email: 'mateoflynn_@hotmail.com', password: 'Mate@200' },
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseAdminAccountsEnv(raw: string | undefined): AdminCredential[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(':');
      if (separator <= 0) return null;
      const email = normalizeEmail(entry.slice(0, separator));
      const password = entry.slice(separator + 1);
      if (!email || !password) return null;
      return { email, password };
    })
    .filter((item): item is AdminCredential => Boolean(item));
}

function getAdminCredentials(): AdminCredential[] {
  const fromPair =
    process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD
      ? [{ email: normalizeEmail(process.env.ADMIN_EMAIL), password: process.env.ADMIN_PASSWORD }]
      : [];
  const fromList = parseAdminAccountsEnv(process.env.ADMIN_ACCOUNTS);
  const merged = [...fromPair, ...fromList, ...DEFAULT_ADMIN_CREDENTIALS];
  const uniqueByEmail = new Map<string, AdminCredential>();
  for (const credential of merged) {
    if (!uniqueByEmail.has(credential.email)) {
      uniqueByEmail.set(credential.email, credential);
    }
  }
  return Array.from(uniqueByEmail.values());
}

interface SessionPayload {
  email: string;
  iat: number;
}

export function isValidAdminCredentials(email: string, password: string): boolean {
  const targetEmail = normalizeEmail(email);
  return getAdminCredentials().some(
    (credential) => credential.email === targetEmail && credential.password === password,
  );
}

export function isKnownAdminEmail(email: string): boolean {
  const targetEmail = normalizeEmail(email);
  return getAdminCredentials().some((credential) => credential.email === targetEmail);
}

export function signAdminSession(email: string): string {
  const payload: SessionPayload = {
    email: normalizeEmail(email),
    iat: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSession(token: string | undefined | null): boolean {
  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed?.email || typeof parsed?.iat !== 'number') {
      return false;
    }

    const maxAgeMs = 1000 * 60 * 60 * 12;
    return Date.now() - parsed.iat <= maxAgeMs;
  } catch {
    return false;
  }
}
