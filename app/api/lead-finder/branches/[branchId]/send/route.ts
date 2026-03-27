import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { sendLeadFinderWhatsapp } from '@/lib/server/lead-finder-data';

type Params = {
  params: Promise<{
    branchId: string;
  }>;
};

export async function POST(request: NextRequest, context: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await context.params;
  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '').trim();
  const tenantId = String(body?.tenantId ?? '').trim();
  const customerId = String(body?.customerId ?? '').trim();
  const serviceId = body?.serviceId ? String(body.serviceId) : null;
  const serviceName = body?.serviceName ? String(body.serviceName) : null;
  const message = body?.message ? String(body.message) : null;

  if (!userId || !tenantId || !branchId || !customerId) {
    return NextResponse.json({ message: 'userId, tenantId, branchId y customerId son obligatorios' }, { status: 400 });
  }

  try {
    const sent = await sendLeadFinderWhatsapp({
      userId,
      tenantId,
      branchId,
      customerId,
      serviceId,
      serviceName,
      message,
    });
    return NextResponse.json({ sent });
  } catch (error: any) {
    return NextResponse.json(
      { message: String(error?.message ?? 'No se pudo enviar WhatsApp') },
      { status: 400 },
    );
  }
}

