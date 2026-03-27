import { NextRequest, NextResponse } from 'next/server';
import { processDueAppointmentWhatsappReminders } from '@/lib/server/appointment-reminders';

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (expected) {
    const provided = request.headers.get('x-cron-secret')?.trim() ?? '';
    if (!provided || provided !== expected) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }
  }

  const result = await processDueAppointmentWhatsappReminders(60);
  return NextResponse.json({ ok: true, ...result });
}

