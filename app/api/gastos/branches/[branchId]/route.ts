import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getTenantAccountAccessSnapshot } from '@/lib/server/admin-data';
import {
  deleteBranchExpense,
  getGastosContext,
  getGastosPermissions,
  upsertBranchExpense,
} from '@/lib/server/gastos-data';

interface Params {
  params: Promise<{ branchId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const accountAccess = await getTenantAccountAccessSnapshot(tenantId);
  if (!accountAccess.isPaid) {
    return NextResponse.json({ message: 'Gastos está disponible solo en plan de pago.' }, { status: 402 });
  }

  const permissions = await getGastosPermissions({ userId, tenantId, branchId });
  if (!permissions.canRead) {
    return NextResponse.json({ message: 'No tenés permisos para ver gastos en esta sucursal' }, { status: 403 });
  }

  try {
    const context = await getGastosContext({ tenantId, branchId });
    return NextResponse.json({ context, permissions });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudieron cargar los gastos' }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const accountAccess = await getTenantAccountAccessSnapshot(tenantId);
  if (!accountAccess.isPaid) {
    return NextResponse.json({ message: 'Gastos está disponible solo en plan de pago.' }, { status: 402 });
  }

  const permissions = await getGastosPermissions({ userId, tenantId, branchId });
  if (!permissions.canWrite) {
    return NextResponse.json({ message: 'No tenés permisos para editar gastos' }, { status: 403 });
  }

  try {
    const result = await upsertBranchExpense({
      tenantId,
      branchId,
      userId,
      expenseId: body?.expenseId ? String(body.expenseId) : undefined,
      name: String(body?.name ?? ''),
      description: body?.description ? String(body.description) : null,
      amountPreTaxCents: Number(body?.amountPreTaxCents ?? 0),
      isFixed: Boolean(body?.isFixed),
      category: body?.category ? String(body.category) : null,
      recurrence: body?.recurrence ? String(body.recurrence) : null,
      isActive: body?.isActive !== false,
      serviceIds: body?.serviceIds,
      productIds: body?.productIds,
    });

    return NextResponse.json({ expense: result }, { status: body?.expenseId ? 200 : 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo guardar el gasto' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const expenseId = String(body?.expenseId ?? '');

  if (!userId || !tenantId || !expenseId) {
    return NextResponse.json({ message: 'userId, tenantId y expenseId son obligatorios' }, { status: 400 });
  }

  const accountAccess = await getTenantAccountAccessSnapshot(tenantId);
  if (!accountAccess.isPaid) {
    return NextResponse.json({ message: 'Gastos está disponible solo en plan de pago.' }, { status: 402 });
  }

  const permissions = await getGastosPermissions({ userId, tenantId, branchId });
  if (!permissions.canWrite) {
    return NextResponse.json({ message: 'No tenés permisos para borrar gastos' }, { status: 403 });
  }

  try {
    const result = await deleteBranchExpense({ tenantId, branchId, expenseId });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo borrar el gasto' }, { status: 400 });
  }
}
