import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { updateUserPassword } from '@/lib/server/admin-data';

interface Params {
  params: Promise<{ userId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { userId } = await params;
  const body = await request.json().catch(() => ({} as any));
  const password = String(body?.password ?? '');

  if (password.length < 8) {
    return NextResponse.json({ message: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }

  const user = await updateUserPassword(userId, password);
  if (!user) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}
