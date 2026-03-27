import { NextRequest, NextResponse } from 'next/server';
import { getTenantBranches } from '@/lib/server/public-booking';
import { triggerAppointmentReminderSweep } from '@/lib/server/appointment-reminders';

interface Params {
  params: Promise<{ tenantSlug: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  void triggerAppointmentReminderSweep().catch(() => null);
  const { tenantSlug } = await params;
  const result = await getTenantBranches(tenantSlug);
  return NextResponse.json(result.payload, { status: result.status });
}
