import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { deleteBranchForTenant } from '@/lib/server/reservas-data';

interface Params {
  params: Promise<{ branchId: string }>;
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const userId = request.nextUrl.searchParams.get('userId');
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!userId || !tenantId || !branchId) {
    return NextResponse.json({ message: 'userId, tenantId y branchId son obligatorios' }, { status: 400 });
  }

  try {
    const branch = await deleteBranchForTenant({ userId, tenantId, branchId });
    return NextResponse.json({ branch });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo dar de baja la sucursal' }, { status: 400 });
  }
}

