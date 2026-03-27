import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { listUserTenants } from '@/lib/server/reservas-data';
import { getUserBranchContext } from '@/lib/server/branch-context';
import { getTenantAccountAccessSnapshot } from '@/lib/server/admin-data';

const CONTEXT_CACHE_TTL_MS = 1500;
const contextCache = new Map<string, { at: number; payload: unknown }>();

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const requestedTenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';
  if (!userId) {
    return NextResponse.json({ message: 'userId es obligatorio' }, { status: 400 });
  }

  const cacheKey = `${userId}:${requestedTenantId || '-'}`;
  const now = Date.now();
  if (!forceRefresh) {
    const cached = contextCache.get(cacheKey);
    if (cached && now - cached.at < CONTEXT_CACHE_TTL_MS) {
      return NextResponse.json(cached.payload);
    }
  }

  const tenants = await listUserTenants(userId);
  if (!tenants.length) {
    const emptyPayload = {
      tenant: null,
      branches: [],
      activeBranchId: null,
      membershipRole: null,
      activeBranchPermissions: [],
      accountAccess: null,
    };
    return NextResponse.json(emptyPayload);
  }

  const tenant = requestedTenantId
    ? tenants.find((item) => item.tenantId === requestedTenantId) ?? tenants[0]
    : tenants[0];

  const branchContext = await getUserBranchContext({ userId, tenantId: tenant.tenantId });
  const accountAccess = await getTenantAccountAccessSnapshot(tenant.tenantId);

  const payload = {
    tenant,
    branches: branchContext.branches,
    activeBranchId: branchContext.activeBranchId,
    membershipRole: branchContext.membershipRole,
    activeBranchPermissions: branchContext.activeBranchPermissions,
    accountAccess,
  };
  if (!forceRefresh) {
    contextCache.set(cacheKey, { at: Date.now(), payload });
  }
  return NextResponse.json(payload);
}
