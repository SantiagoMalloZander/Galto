import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { assertTenantAccess } from '@/lib/server/reservas-data';
import { upsertTenantOnboardingProfile, type BusinessLine } from '@/lib/server/tenant-onboarding-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '').trim();
  const tenantId = String(body?.tenantId ?? '').trim();
  const businessLine = String(body?.businessLine ?? '').trim().toUpperCase() as BusinessLine;
  const workersCount = Number(body?.workersCount ?? 1);
  const countryCode = String(body?.countryCode ?? '').trim().toUpperCase();
  const countryName = String(body?.countryName ?? '').trim();

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }
  if (businessLine !== 'BARBERIA' && businessLine !== 'PELUQUERIA' && businessLine !== 'ESTETICA') {
    return NextResponse.json({ message: 'businessLine inválido' }, { status: 400 });
  }
  if (!Number.isFinite(workersCount) || workersCount < 1) {
    return NextResponse.json({ message: 'workersCount inválido' }, { status: 400 });
  }
  if (!countryCode || !countryName) {
    return NextResponse.json({ message: 'countryCode y countryName son obligatorios' }, { status: 400 });
  }

  const membership = await assertTenantAccess(userId, tenantId);
  if (!membership) {
    return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  }
  if (membership.role !== 'OWNER') {
    return NextResponse.json({ message: 'Solo el owner puede configurar este onboarding' }, { status: 403 });
  }

  try {
    const profile = await upsertTenantOnboardingProfile({
      tenantId,
      businessLine,
      workersCount,
      countryCode,
      countryName,
    });
    return NextResponse.json({ profile });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo guardar la configuración inicial' }, { status: 400 });
  }
}
