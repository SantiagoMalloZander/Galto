import { NextRequest, NextResponse } from 'next/server';
import { getAvailability } from '@/lib/server/public-booking';
import { triggerAppointmentReminderSweep } from '@/lib/server/appointment-reminders';

interface Params {
  params: Promise<{ tenantSlug: string; branchSlug: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  void triggerAppointmentReminderSweep().catch(() => null);
  const { tenantSlug, branchSlug } = await params;
  const date = request.nextUrl.searchParams.get('date') ?? '';
  const serviceIdsRaw = request.nextUrl.searchParams.get('serviceIds') ?? '';
  const employeeId = request.nextUrl.searchParams.get('employeeId') ?? undefined;

  const serviceIds = serviceIdsRaw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!date || serviceIds.length === 0) {
    return NextResponse.json({ message: 'date y serviceIds son obligatorios' }, { status: 400 });
  }

  const result = await getAvailability({
    tenantSlug,
    branchSlug,
    date,
    serviceIds,
    employeeId,
  });

  return NextResponse.json(result.payload, { status: result.status });
}
