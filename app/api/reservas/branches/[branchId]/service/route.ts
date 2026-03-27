import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { assertTenantAccess, createBranchService, getBranchFullConfig } from '@/lib/server/reservas-data';

interface Params {
  params: Promise<{ branchId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
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

  await createBranchService({
    tenantId,
    branchId,
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
