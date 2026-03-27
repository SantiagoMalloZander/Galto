import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { deleteTenantCustomer, getClientesPermissions, listTenantCustomers } from '@/lib/server/clientes-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  const branchId = request.nextUrl.searchParams.get('branchId') ?? '';
  const search = request.nextUrl.searchParams.get('search');
  const filterParam = request.nextUrl.searchParams.get('filter');

  if (!userId || !tenantId || !branchId) {
    return NextResponse.json({ message: 'userId, tenantId y branchId son obligatorios' }, { status: 400 });
  }

  const permissions = await getClientesPermissions({ userId, tenantId, branchId });
  if (!permissions.canRead) {
    return NextResponse.json({ message: 'No tenés permisos para ver clientes' }, { status: 403 });
  }

  try {
    const customers = await listTenantCustomers({
      tenantId,
      search,
      limit: 200,
      filter:
        filterParam === 'WITH_VISITS' || filterParam === 'WITHOUT_VISITS' || filterParam === 'TEST'
          ? filterParam
          : 'ALL',
    });
    return NextResponse.json({ customers, permissions });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudieron cargar clientes' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const branchId = String(body?.branchId ?? '');
  const customerId = String(body?.customerId ?? '');

  if (!userId || !tenantId || !branchId || !customerId) {
    return NextResponse.json({ message: 'userId, tenantId, branchId y customerId son obligatorios' }, { status: 400 });
  }

  const permissions = await getClientesPermissions({ userId, tenantId, branchId });
  if (!permissions.canWrite) {
    return NextResponse.json({ message: 'No tenés permisos para borrar clientes' }, { status: 403 });
  }

  try {
    const result = await deleteTenantCustomer({ tenantId, customerId });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo borrar el cliente' }, { status: 400 });
  }
}
