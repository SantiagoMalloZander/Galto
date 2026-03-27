import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { upsertSubmission } from '@/lib/server/content-data';

interface Params {
  params: Promise<{ competitionId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { competitionId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const platform = String(body?.platform ?? '');
  const videoUrl = String(body?.videoUrl ?? '');

  if (!userId || !tenantId || !platform || !videoUrl) {
    return NextResponse.json({ message: 'userId, tenantId, platform y videoUrl son obligatorios' }, { status: 400 });
  }

  try {
    const submission = await upsertSubmission({
      userId,
      tenantId,
      competitionId,
      platform,
      videoUrl,
    });
    const warning = submission.autoDetected
      ? null
      : 'Guardado con visitas previas/0. Reintentá luego para actualizar visitas automáticas.';
    return NextResponse.json({ submission, warning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo guardar el envío' }, { status: 400 });
  }
}
