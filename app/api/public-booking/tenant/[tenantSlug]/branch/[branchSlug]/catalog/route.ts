import { NextRequest, NextResponse } from 'next/server';
import { getBranchCatalog } from '@/lib/server/public-booking';
import { triggerAppointmentReminderSweep } from '@/lib/server/appointment-reminders';

interface Params {
  params: Promise<{ tenantSlug: string; branchSlug: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  void triggerAppointmentReminderSweep().catch(() => null);
  const { tenantSlug, branchSlug } = await params;
  const result = await getBranchCatalog(tenantSlug, branchSlug);
  return NextResponse.json(result.payload, { status: result.status });
}
