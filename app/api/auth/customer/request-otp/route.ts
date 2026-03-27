import { NextRequest, NextResponse } from 'next/server';
import { requestCustomerWhatsappOtp } from '@/lib/server/customer-accounts';
import { triggerAppointmentReminderSweep } from '@/lib/server/appointment-reminders';

export async function POST(request: NextRequest) {
  void triggerAppointmentReminderSweep().catch(() => null);
  const body = await request.json().catch(() => ({} as any));
  const phone = String(body?.phone ?? '').trim();
  const fullName = body?.fullName ? String(body.fullName) : null;
  const tenantSlug = body?.tenantSlug ? String(body.tenantSlug).trim() : null;
  const branchSlug = body?.branchSlug ? String(body.branchSlug).trim() : null;

  if (!phone) {
    return NextResponse.json({ message: 'phone es obligatorio' }, { status: 400 });
  }

  try {
    const result = await requestCustomerWhatsappOtp({ phone, fullName, tenantSlug, branchSlug });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo enviar el código' }, { status: 400 });
  }
}
