import { NextRequest, NextResponse } from 'next/server';
import { getInvitationPublicInfo } from '@/lib/server/cuentas-data';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  if (!token) {
    return NextResponse.json({ message: 'token es obligatorio' }, { status: 400 });
  }

  try {
    const info = await getInvitationPublicInfo(token);
    return NextResponse.json(info);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo validar invitación' }, { status: 400 });
  }
}

