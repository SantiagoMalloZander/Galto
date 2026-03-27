import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { createSupportPurchase } from '@/lib/server/support-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const packageCode = String(body?.packageCode ?? '');
  const paymentMethod = String(body?.paymentMethod ?? '') as 'MERCADOPAGO' | 'TRANSFER';
  const contactName = String(body?.contactName ?? '');
  const contactPhone = String(body?.contactPhone ?? '');

  if (!userId || !tenantId || !packageCode || !paymentMethod || !contactName || !contactPhone) {
    return NextResponse.json(
      { message: 'userId, tenantId, packageCode, paymentMethod, contactName y contactPhone son obligatorios' },
      { status: 400 },
    );
  }

  try {
    const purchase = await createSupportPurchase({
      userId,
      tenantId,
      packageCode,
      paymentMethod,
      contactName,
      contactPhone,
    });
    return NextResponse.json({ purchase }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo crear la compra de soporte' }, { status: 400 });
  }
}
