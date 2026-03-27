import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { PlanType, upsertTenantPlan } from '@/lib/server/admin-data';

interface Params {
  params: Promise<{ tenantId: string }>;
}

const ALLOWED_APPS = [
  'reservas',
  'calendario',
  'cuentas',
  'clientes',
  'lead_finder',
  'dashboard',
  'puntos',
  'recompensas',
  'contenido',
] as const;

function normalizeApps(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((value): value is string => {
    return typeof value === 'string' && (ALLOWED_APPS as readonly string[]).includes(value);
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { tenantId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const rawPlanType = body?.planType as string;
  const planType = (rawPlanType === 'PAID_CUSTOM' ? 'PAID_FULL' : rawPlanType) as PlanType;
  const isPaid = Boolean(body?.isPaid);
  const demoEndsAt = body?.demoEndsAt ? String(body.demoEndsAt) : null;
  const paidBranchSlots = Math.max(1, Number(body?.paidBranchSlots ?? 1));
  const enabledApps = normalizeApps(body?.enabledApps);

  if (!['DEMO', 'PAID_FULL'].includes(planType)) {
    return NextResponse.json({ message: 'planType inválido' }, { status: 400 });
  }

  const plan = await upsertTenantPlan({
    tenantId,
    planType,
    isPaid,
    enabledApps,
    demoEndsAt,
    paidBranchSlots,
  });

  return NextResponse.json({ ok: true, plan });
}
