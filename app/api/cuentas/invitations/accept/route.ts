import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { acceptInvitation } from '@/lib/server/cuentas-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));

  const token = String(body?.token ?? '');
  const userId = String(body?.userId ?? '');

  if (!token || !userId) {
    return NextResponse.json({ message: 'token y userId son obligatorios' }, { status: 400 });
  }

  try {
    const result = await acceptInvitation({ token, userId });
    const response = NextResponse.json(result, { status: 201 });
    if (result?.membership) {
      response.cookies.set('galto_has_membership', '1', {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
      });
    }
    return response;
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo aceptar la invitación' }, { status: 400 });
  }
}
