import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import {
  listUserOwnedTenants,
  verifyAndApplyMercadoPagoPaymentById,
  verifyAndApplyMercadoPagoPreapprovalById,
} from '@/lib/server/admin-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const paymentId = String(body?.paymentId ?? '');
  const preapprovalId = String(body?.preapprovalId ?? '');

  if (!userId || !tenantId || (!paymentId && !preapprovalId)) {
    return NextResponse.json({ message: 'userId, tenantId y paymentId/preapprovalId son obligatorios' }, { status: 400 });
  }

  const memberships = await listUserOwnedTenants(userId);
  if (!memberships.some((membership) => membership.tenantId === tenantId)) {
    return NextResponse.json({ message: 'Sin acceso a este tenant' }, { status: 403 });
  }

  try {
    const verification = paymentId
      ? await verifyAndApplyMercadoPagoPaymentById(paymentId)
      : await verifyAndApplyMercadoPagoPreapprovalById(preapprovalId);
    return NextResponse.json({ verification });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo verificar el pago' }, { status: 400 });
  }
}
