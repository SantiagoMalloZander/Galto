import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { verifySupportMercadoPago } from '@/lib/server/support-data';

interface Params {
  params: Promise<{ purchaseId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { purchaseId } = await params;
  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const paymentId = String(body?.paymentId ?? '');

  if (!userId || !tenantId || !paymentId) {
    return NextResponse.json({ message: 'userId, tenantId y paymentId son obligatorios' }, { status: 400 });
  }

  try {
    const verification = await verifySupportMercadoPago({
      userId,
      tenantId,
      purchaseId,
      paymentId,
    });
    return NextResponse.json({ verification });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo verificar pago de soporte' }, { status: 400 });
  }
}
