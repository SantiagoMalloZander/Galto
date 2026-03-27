import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { deleteCustomerAccountById } from '@/lib/server/customer-accounts';

interface Params {
  params: Promise<{ customerId: string }>;
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { customerId } = await params;
  if (!customerId) {
    return NextResponse.json({ message: 'customerId es obligatorio' }, { status: 400 });
  }

  try {
    const deleted = await deleteCustomerAccountById(customerId);
    if (!deleted) {
      return NextResponse.json({ message: 'Cliente no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, action: 'deleted', customer: deleted });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo borrar la cuenta cliente' }, { status: 400 });
  }
}
