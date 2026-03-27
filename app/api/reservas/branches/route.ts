import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import {
  assertTenantAccess,
  createBranchForTenant,
  listBranchesForTenant,
} from '@/lib/server/reservas-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId');
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const access = await assertTenantAccess(userId, tenantId);
  if (!access) {
    return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  }

  const branches = await listBranchesForTenant(tenantId);
  return NextResponse.json({ branches });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const name = String(body?.name ?? '');
  const slug = body?.slug ? String(body.slug) : undefined;
  const timeZone = body?.timeZone ? String(body.timeZone) : undefined;

  if (!userId || !tenantId || name.trim().length < 2) {
    return NextResponse.json({ message: 'userId, tenantId y name son obligatorios' }, { status: 400 });
  }

  try {
    const branch = await createBranchForTenant({ userId, tenantId, name, slug, timeZone });
    return NextResponse.json({ branch });
  } catch (error: any) {
    const code = String(error?.code ?? '');
    if (code === 'BRANCH_LIMIT_REQUIRES_PAYMENT') {
      return NextResponse.json({ message: error?.message ?? 'Necesitás ampliar tu plan para agregar otra sucursal', code }, { status: 402 });
    }
    return NextResponse.json({ message: error?.message ?? 'No se pudo crear sucursal', code: code || undefined }, { status: 400 });
  }
}
