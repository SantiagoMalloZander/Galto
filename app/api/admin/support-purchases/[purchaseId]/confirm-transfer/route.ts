import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { confirmSupportTransferById } from '@/lib/server/support-data';

interface Params {
  params: Promise<{ purchaseId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { purchaseId } = await params;
  const updated = await confirmSupportTransferById(purchaseId);
  if (!updated) {
    return NextResponse.json({ message: 'No se pudo confirmar esta transferencia' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
