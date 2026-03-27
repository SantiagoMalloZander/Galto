'use client';

import { useEffect, useMemo, useState } from 'react';
import { getStoredAuthSession, persistHasMembership, updateStoredAccountAccess } from '@/lib/auth';
import { buildAccountAccess } from '@/lib/entitlements';

type TenantContext = {
  membershipId: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

type BranchContext = {
  id: string;
  name: string;
  slug: string;
  timeZone: string;
};

type AppContextPayload = {
  tenant: TenantContext | null;
  branches: BranchContext[];
  activeBranchId: string | null;
  membershipRole: string | null;
  activeBranchPermissions: string[];
  accountAccess?: unknown;
};

const APP_CONTEXT_CACHE_TTL_MS = 3000;
const appContextCache = new Map<string, { at: number; payload: AppContextPayload }>();
const appContextInflight = new Map<string, Promise<AppContextPayload>>();

async function loadAppContextCached(userId: string, forceRefresh = false): Promise<AppContextPayload> {
  if (forceRefresh) {
    appContextCache.delete(userId);
    appContextInflight.delete(userId);
  }

  const now = Date.now();
  const cached = appContextCache.get(userId);
  if (!forceRefresh && cached && now - cached.at < APP_CONTEXT_CACHE_TTL_MS) {
    return cached.payload;
  }

  const inflight = appContextInflight.get(userId);
  if (!forceRefresh && inflight) {
    return inflight;
  }

  const request = fetch(
    `/api/app/context?userId=${encodeURIComponent(userId)}${forceRefresh ? '&refresh=1' : ''}`,
    { cache: 'no-store' },
  )
    .then(async (response) => {
      const payload = (await response.json().catch(() => ({}))) as Partial<AppContextPayload> & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'No se pudo cargar contexto de sucursal');
      const normalized: AppContextPayload = {
        tenant: payload?.tenant ?? null,
        branches: payload?.branches ?? [],
        activeBranchId: payload?.activeBranchId ?? null,
        membershipRole: payload?.membershipRole ?? null,
        activeBranchPermissions: Array.isArray(payload?.activeBranchPermissions) ? payload.activeBranchPermissions : [],
        accountAccess: payload?.accountAccess ?? null,
      };
      appContextCache.set(userId, { at: Date.now(), payload: normalized });
      return normalized;
    })
    .finally(() => {
      appContextInflight.delete(userId);
    });

  if (!forceRefresh) {
    appContextInflight.set(userId, request);
  }
  return request;
}

function storageKey(tenantId: string) {
  return `galto_active_branch_${tenantId}`;
}

export function useBranchContext() {
  const [session] = useState(() => getStoredAuthSession());
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [branches, setBranches] = useState<BranchContext[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [activeBranchPermissions, setActiveBranchPermissions] = useState<string[]>([]);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const userId = session?.user?.id ?? '';

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const payload = await loadAppContextCached(userId, refreshNonce > 0);
        if (cancelled) return;

        if (payload?.accountAccess) {
          updateStoredAccountAccess(buildAccountAccess({ accountAccess: payload.accountAccess }));
        }

        const nextTenant = payload?.tenant ?? null;
        const nextBranches = payload?.branches ?? [];
        persistHasMembership(Boolean(nextTenant));
        let nextActive = payload?.activeBranchId ?? null;
        let nextPermissions = Array.isArray(payload?.activeBranchPermissions) ? payload.activeBranchPermissions : [];

        if (nextTenant) {
          const local = window.localStorage.getItem(storageKey(nextTenant.tenantId));
          if (!nextActive && nextBranches.length === 1) {
            nextActive = nextBranches[0].id;
            void fetch('/api/app/context/active-branch', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, tenantId: nextTenant.tenantId, branchId: nextActive }),
            }).catch(() => null);
          } else if (!nextActive && local && nextBranches.some((branch) => branch.id === local)) {
            nextActive = local;
            void fetch('/api/app/context/active-branch', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, tenantId: nextTenant.tenantId, branchId: nextActive }),
            }).catch(() => null);
          }

          if (nextActive) {
            window.localStorage.setItem(storageKey(nextTenant.tenantId), nextActive);
          }
        }

        setTenant(nextTenant);
        setBranches(nextBranches);
        setActiveBranchIdState(nextActive);
        if (!nextActive) {
          nextPermissions = [];
        }
        setMembershipRole(payload?.membershipRole ?? null);
        setActiveBranchPermissions(nextPermissions);
      } catch {
        if (!cancelled) {
          persistHasMembership(false);
          setTenant(null);
          setBranches([]);
          setActiveBranchIdState(null);
          setMembershipRole(null);
          setActiveBranchPermissions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    const sync = () => {
      if (!tenant?.tenantId) return;
      const value = window.localStorage.getItem(storageKey(tenant.tenantId));
      if (value) setActiveBranchIdState(value);
    };
    const refreshContext = () => {
      appContextCache.delete(userId);
      appContextInflight.delete(userId);
      setRefreshNonce((prev) => prev + 1);
    };

    window.addEventListener('storage', sync);
    window.addEventListener('galto-active-branch', sync as EventListener);
    window.addEventListener('galto-auth-updated', refreshContext as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', sync);
      window.removeEventListener('galto-active-branch', sync as EventListener);
      window.removeEventListener('galto-auth-updated', refreshContext as EventListener);
    };
  }, [userId, refreshNonce]);

  const setActiveBranchId = async (branchId: string) => {
    if (!userId || !tenant?.tenantId) return false;
    const response = await fetch('/api/app/context/active-branch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId: tenant.tenantId, branchId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message ?? 'No se pudo cambiar de sucursal');
    }

    setActiveBranchIdState(branchId);
    window.localStorage.setItem(storageKey(tenant.tenantId), branchId);
    window.dispatchEvent(new CustomEvent('galto-active-branch'));
    setRefreshNonce((prev) => prev + 1);
    return true;
  };

  const activeBranch = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId) ?? null,
    [branches, activeBranchId],
  );

  return {
    loading,
    tenant,
    branches,
    activeBranchId,
    activeBranch,
    membershipRole,
    activeBranchPermissions,
    hasMultipleBranches: branches.length > 1,
    setActiveBranchId,
  };
}
