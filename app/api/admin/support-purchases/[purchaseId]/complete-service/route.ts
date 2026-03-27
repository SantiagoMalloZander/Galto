import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { completeSupportServiceById } from '@/lib/server/support-data';

interface Params {
  params: Promise<{ purchaseId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { purchaseId } = await params;
  const updated = await completeSupportServiceById(purchaseId);
  if (!updated) {
    return NextResponse.json(
      { message: 'No se pudo marcar este servicio como realizado (verificá pago y estado actual)' },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
