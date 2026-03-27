import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import {
  getInventoryContext,
  getInventoryPermissions,
  upsertBranchProduct,
  upsertInventorySettings,
} from '@/lib/server/pos-data';

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

  const permissions = await getInventoryPermissions({ userId, tenantId, branchId });
  if (!permissions.canRead) {
    return NextResponse.json({ message: 'No tenés permisos para ver inventario en esta sucursal' }, { status: 403 });
  }

  try {
    const context = await getInventoryContext({ tenantId, branchId });
    return NextResponse.json({ context, permissions });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo cargar inventario' }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const action = String(body?.action ?? '');

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const permissions = await getInventoryPermissions({ userId, tenantId, branchId });
  if (!permissions.canWrite) {
    return NextResponse.json({ message: 'No tenés permisos para editar inventario' }, { status: 403 });
  }

  try {
    if (action === 'update_settings') {
      const settings = await upsertInventorySettings({
        tenantId,
        branchId,
        useInventory: Boolean(body?.useInventory),
      });
      return NextResponse.json({ settings });
    }

    if (action === 'upsert_product') {
      const product = await upsertBranchProduct({
        tenantId,
        branchId,
        productId: body?.productId ? String(body.productId) : undefined,
        name: String(body?.name ?? ''),
        priceCents: Number(body?.priceCents ?? 0),
        stockQuantity: Number(body?.stockQuantity ?? 0),
        trackMinStock: Boolean(body?.trackMinStock),
        minStockQuantity: Number(body?.minStockQuantity ?? 0),
        photoUrl: body?.photoUrl ? String(body.photoUrl) : null,
        isActive: body?.isActive !== false,
      });
      return NextResponse.json({ product }, { status: 201 });
    }

    return NextResponse.json({ message: 'Acción inválida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo guardar inventario' }, { status: 400 });
  }
}

