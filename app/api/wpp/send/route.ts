import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifyAdminSession } from '@/lib/server/admin-auth';
import { getEvolutionConnectionState, normalizePhone, sendEvolutionText } from '@/lib/server/wpp-prospector';

type ContactInput = {
  name?: string;
  phone: string;
};

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminSession(token)) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as any));
  const rawContacts = Array.isArray(body?.contacts) ? (body.contacts as ContactInput[]) : [];
  const message = String(body?.message ?? '').trim();

  if (!message) {
    return NextResponse.json({ message: 'El mensaje es obligatorio' }, { status: 400 });
  }
  if (!rawContacts.length) {
    return NextResponse.json({ message: 'Cargá al menos un número' }, { status: 400 });
  }
  if (rawContacts.length > 300) {
    return NextResponse.json({ message: 'Máximo 300 números por envío' }, { status: 400 });
  }

  const contacts = rawContacts
    .map((item) => ({
      name: String(item?.name ?? '').trim() || null,
      phone: normalizePhone(item?.phone ?? ''),
    }))
    .filter((item) => Boolean(item.phone));

  if (!contacts.length) {
    return NextResponse.json({ message: 'No hay números válidos' }, { status: 400 });
  }

  const state = await getEvolutionConnectionState().catch(() => '');
  if (state && state !== 'open') {
    return NextResponse.json(
      {
        message:
          'Evolution está desconectado. Abrí Evolution Manager y reconectá la instancia (escaneá QR) antes de enviar.',
      },
      { status: 400 },
    );
  }

  const results: Array<{ phone: string; name: string | null; ok: boolean; error?: string }> = [];
  for (const contact of contacts) {
    try {
      await sendEvolutionText({
        phone: contact.phone!,
        text: contact.name ? message.replace(/\{\{nombre\}\}/gi, contact.name) : message,
      });
      results.push({ phone: contact.phone!, name: contact.name, ok: true });
    } catch (error: any) {
      results.push({
        phone: contact.phone!,
        name: contact.name,
        ok: false,
        error: error?.message ?? 'Error desconocido',
      });
    }
  }

  const sent = results.filter((item) => item.ok).length;
  const failed = results.length - sent;

  return NextResponse.json({
    summary: {
      total: results.length,
      sent,
      failed,
    },
    results,
  });
}
