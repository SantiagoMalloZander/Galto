import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { createCompetition } from '@/lib/server/content-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const title = String(body?.title ?? '');
  const prizeText = String(body?.prizeText ?? '');
  const deadlineAt = String(body?.deadlineAt ?? '');
  const notes = body?.notes ? String(body.notes) : null;

  if (!userId || !tenantId || !title || !prizeText || !deadlineAt) {
    return NextResponse.json(
      { message: 'userId, tenantId, title, prizeText y deadlineAt son obligatorios' },
      { status: 400 },
    );
  }

  try {
    const competition = await createCompetition({
      userId,
      tenantId,
      title,
      prizeText,
      deadlineAt,
      notes,
    });
    return NextResponse.json({ competition }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo crear la competencia' }, { status: 400 });
  }
}
