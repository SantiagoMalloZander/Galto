import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { updateMembershipRole } from '@/lib/server/admin-data';

interface Params {
  params: Promise<{ membershipId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { membershipId } = await params;
  const body = await request.json().catch(() => ({} as any));
  const role = String(body?.role ?? '') as 'OWNER' | 'MANAGER' | 'EMPLOYEE';

  if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'EMPLOYEE') {
    return NextResponse.json({ message: 'role inválido' }, { status: 400 });
  }

  try {
    const membership = await updateMembershipRole(membershipId, role);
    if (!membership) {
      return NextResponse.json({ message: 'Membresía no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, membership });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo actualizar el rol' }, { status: 400 });
  }
}

