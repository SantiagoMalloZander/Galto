import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getTenantBillingStatus, listUserOwnedTenants } from '@/lib/server/admin-data';

const BILLING_STATUS_CACHE_TTL_MS = 2000;
const billingStatusCache = new Map<string, { at: number; payload: unknown }>();

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const userId = request.nextUrl.searchParams.get('userId');
  const tenantId = request.nextUrl.searchParams.get('tenantId');

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const cacheKey = `${userId}:${tenantId}`;
  const now = Date.now();
  const cached = billingStatusCache.get(cacheKey);
  if (cached && now - cached.at < BILLING_STATUS_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  const memberships = await listUserOwnedTenants(userId);
  if (!memberships.some((membership) => membership.tenantId === tenantId)) {
    return NextResponse.json({ message: 'Sin acceso a este tenant' }, { status: 403 });
  }

  const status = await getTenantBillingStatus(tenantId);
  billingStatusCache.set(cacheKey, { at: Date.now(), payload: status });
  return NextResponse.json(status);
}
