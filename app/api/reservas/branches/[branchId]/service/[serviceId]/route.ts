import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import {
  assertTenantAccess,
  deleteBranchService,
  getBranchFullConfig,
  updateBranchService,
} from '@/lib/server/reservas-data';

interface Params {
  params: Promise<{ branchId: string; serviceId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId, serviceId } = await params;
  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');

  if (!userId || !tenantId || !body?.name) {
    return NextResponse.json({ message: 'userId, tenantId y name son obligatorios' }, { status: 400 });
  }

  const access = await assertTenantAccess(userId, tenantId);
  if (!access) {
    return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  }

  await updateBranchService({
    tenantId,
    branchId,
    serviceId,
    name: String(body.name),
    durationMins: Number(body.durationMins ?? 30),
    priceCents: Number(body.priceCents ?? 0),
    categoryName: body.categoryName ? String(body.categoryName) : null,
    description: body.description ? String(body.description) : null,
    imageUrl: body.imageUrl ? String(body.imageUrl) : null,
    requiresDeposit: Boolean(body.requiresDeposit),
    isActive: body.isActive !== false,
  });

  const config = await getBranchFullConfig(tenantId, branchId);
  return NextResponse.json({ config });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId, serviceId } = await params;
  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const access = await assertTenantAccess(userId, tenantId);
  if (!access) {
    return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  }

  await deleteBranchService({ tenantId, branchId, serviceId });
  const config = await getBranchFullConfig(tenantId, branchId);
  return NextResponse.json({ config });
}
