import { NextRequest, NextResponse } from 'next/server';
import { createPublicAppointment } from '@/lib/server/public-booking';
import { CUSTOMER_ACCESS_COOKIE, verifyCustomerToken } from '@/lib/server/customer-auth';
import { hasBranchWhatsappConfiguredBySlug, recordCustomerTenantActivity } from '@/lib/server/customer-accounts';
import { triggerAppointmentReminderSweep } from '@/lib/server/appointment-reminders';

interface Params {
  params: Promise<{ tenantSlug: string; branchSlug: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  void triggerAppointmentReminderSweep().catch(() => null);
  const { tenantSlug, branchSlug } = await params;
  const requiresCustomerAuth = await hasBranchWhatsappConfiguredBySlug({ tenantSlug, branchSlug });
  const accessToken = request.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value ?? null;
  const customerAuth = verifyCustomerToken(accessToken, 'access');
  if (requiresCustomerAuth && !customerAuth) {
    return NextResponse.json({ message: 'Iniciá sesión con teléfono y código por WhatsApp para reservar' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as any));

  const serviceIds = Array.isArray(body?.serviceIds)
    ? body.serviceIds.map((value: unknown) => String(value)).filter(Boolean)
    : [];

  const startsAt = String(body?.startsAt ?? '');
  const employeeId = body?.employeeId ? String(body.employeeId) : undefined;
  const fullName = String(body?.customer?.fullName ?? '').trim();
  const phone = String(body?.customer?.phone ?? '').trim();

  if (!serviceIds.length || !startsAt || !fullName || !phone) {
    return NextResponse.json({ message: 'serviceIds, startsAt, fullName y phone son obligatorios' }, { status: 400 });
  }

  if (requiresCustomerAuth && customerAuth && phone.trim() !== customerAuth.phone) {
    return NextResponse.json({ message: 'El teléfono debe coincidir con tu sesión' }, { status: 400 });
  }

  const result = await createPublicAppointment({
    tenantSlug,
    branchSlug,
    serviceIds,
    startsAt,
    employeeId,
    customer: { fullName, phone },
  });

  if (result.status >= 200 && result.status < 300 && customerAuth) {
    await recordCustomerTenantActivity({
      customerUserId: customerAuth.customerUserId,
      tenantSlug,
      fullName,
      phone,
    });
  }

  return NextResponse.json(result.payload, { status: result.status });
}
