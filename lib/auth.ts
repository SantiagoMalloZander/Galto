import { AccountAccess, buildAccountAccess } from './entitlements';

export const ACCESS_TOKEN_COOKIE = 'galto_access_token';
export const HAS_MEMBERSHIP_COOKIE = 'galto_has_membership';
const ACCESS_TOKEN_STORAGE = 'galto_access_token';
const AUTH_SESSION_STORAGE = 'galto_auth_session';
const AUTH_UPDATED_EVENT = 'galto-auth-updated';

function notifyAuthUpdated() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT));
}

export interface AuthSessionUser {
  id: string;
  email: string;
  fullName?: string | null;
}

export interface AuthSessionMembership {
  membershipId: string;
  role: 'OWNER' | 'MANAGER' | 'EMPLOYEE' | string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthSessionUser;
  memberships: AuthSessionMembership[];
  accountAccess: AccountAccess;
}

export function persistAccessToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:';
  const encoded = encodeURIComponent(token);
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encoded}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${secure ? '; Secure' : ''}`;
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE, token);
}

export function persistAuthSession(payload: any) {
  if (typeof window === 'undefined') {
    return;
  }

  const token = payload?.accessToken;
  if (!token || typeof token !== 'string') {
    throw new Error('El servidor no devolvió accessToken');
  }

  persistAccessToken(token);

  const memberships = normalizeMemberships(payload?.memberships);

  const session: AuthSession = {
    accessToken: token,
    user: {
      id: payload?.user?.id,
      email: payload?.user?.email,
      fullName: payload?.user?.fullName ?? null,
    },
    memberships,
    accountAccess: buildAccountAccess(payload),
  };

  persistHasMembership(memberships.length > 0);
  window.localStorage.setItem(AUTH_SESSION_STORAGE, JSON.stringify(session));
  notifyAuthUpdated();
}

export function persistHasMembership(hasMembership: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:';
  const value = hasMembership ? '1' : '0';
  document.cookie = `${HAS_MEMBERSHIP_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function updateStoredAccountAccess(accountAccess: AccountAccess) {
  if (typeof window === 'undefined') {
    return;
  }

  const current = getStoredAuthSession();
  if (!current) {
    return;
  }

  const next: AuthSession = {
    ...current,
    accountAccess,
  };

  const prevSerialized = JSON.stringify(current.accountAccess ?? null);
  const nextSerialized = JSON.stringify(accountAccess ?? null);
  if (prevSerialized === nextSerialized) {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE, JSON.stringify(next));
  notifyAuthUpdated();
}

export function updateStoredMemberships(memberships: AuthSessionMembership[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const current = getStoredAuthSession();
  if (!current) {
    return;
  }

  const normalized = normalizeMemberships(memberships);
  const next: AuthSession = {
    ...current,
    memberships: normalized,
  };
  persistHasMembership(normalized.length > 0);
  window.localStorage.setItem(AUTH_SESSION_STORAGE, JSON.stringify(next));
  notifyAuthUpdated();
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:';
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`;
  document.cookie = `${HAS_MEMBERSHIP_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`;
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE);
  window.localStorage.removeItem(AUTH_SESSION_STORAGE);
  notifyAuthUpdated();
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE);
}

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function normalizeMemberships(input: unknown): AuthSessionMembership[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((membership: any) => ({
      membershipId: membership?.membershipId ?? membership?.id ?? '',
      role: membership?.role ?? '',
      tenantId: membership?.tenantId ?? membership?.tenant?.id ?? '',
      tenantSlug: membership?.tenantSlug ?? membership?.tenant?.slug ?? '',
      tenantName: membership?.tenantName ?? membership?.tenant?.name ?? '',
    }))
    .filter((membership) => membership.membershipId && membership.tenantId);
}
