import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { saveSupportSummary } from '@/lib/server/support-data';

interface Params {
  params: Promise<{ purchaseId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { purchaseId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    const saved = await saveSupportSummary({
      userId,
      tenantId,
      purchaseId,
      businessContext: body?.businessContext,
      need: body?.need,
      goal: body?.goal,
      notes: body?.notes,
    });
    return NextResponse.json({ saved });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo guardar el resumen' }, { status: 400 });
  }
}
