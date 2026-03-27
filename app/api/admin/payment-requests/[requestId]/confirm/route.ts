import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { confirmPaymentRequest } from '@/lib/server/admin-data';

interface Params {
  params: Promise<{ requestId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { requestId } = await params;
  const result = await confirmPaymentRequest(requestId);
  if (!result) {
    return NextResponse.json({ message: 'Solicitud no encontrada o ya procesada' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, result });
}
