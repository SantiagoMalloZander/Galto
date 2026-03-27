import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { createPaymentRequest, listUserOwnedTenants } from '@/lib/server/admin-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const rawPlanType = String(body?.planType ?? '');
  const planType: 'PAID_FULL' | null =
    rawPlanType === 'PAID_FULL' || rawPlanType === 'PAID_CUSTOM' ? 'PAID_FULL' : null;
  const selectedApps = Array.isArray(body?.selectedApps)
    ? body.selectedApps.filter((app: unknown) => typeof app === 'string')
    : [];
  const billingCycle = body?.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
  const paymentProvider = body?.paymentProvider === 'TRANSFER' ? 'TRANSFER' : 'MERCADOPAGO';
  const purpose = body?.purpose === 'ADD_BRANCH' ? 'ADD_BRANCH' : 'PLAN';
  const branchSlotsQty = Math.max(1, Number(body?.branchSlotsQty ?? 1));

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  if (!planType) {
    return NextResponse.json({ message: 'planType inválido' }, { status: 400 });
  }

  const memberships = await listUserOwnedTenants(userId);
  const tenantMembership = memberships.find((membership) => membership.tenantId === tenantId);
  if (!tenantMembership) {
    return NextResponse.json({ message: 'Sin acceso a este tenant' }, { status: 403 });
  }
  if (tenantMembership.role !== 'OWNER') {
    return NextResponse.json({ message: 'Solo el owner puede gestionar pagos del negocio' }, { status: 403 });
  }

  try {
    const paymentRequest = await createPaymentRequest({
      tenantId,
      requestedByUserId: userId,
      planType,
      selectedApps,
      billingCycle,
      preferredProvider: paymentProvider,
      purpose,
      branchSlotsQty,
    });

    return NextResponse.json({ paymentRequest });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo crear la solicitud de pago' }, { status: 400 });
  }
}
