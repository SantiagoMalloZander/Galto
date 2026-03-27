import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAndApplyMercadoPagoPaymentById,
  verifyAndApplyMercadoPagoPreapprovalById,
} from '@/lib/server/admin-data';

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic') || url.searchParams.get('type') || '';
  const dataId = url.searchParams.get('id') || url.searchParams.get('data.id') || '';

  let resourceId = dataId;

  if (!resourceId) {
    const body = await request.json().catch(() => ({} as any));
    resourceId = String(body?.data?.id ?? body?.id ?? '');
  }

  if (topic && topic !== 'payment' && topic !== 'preapproval' && topic !== 'subscription_preapproval') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!resourceId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    if (topic === 'preapproval' || topic === 'subscription_preapproval') {
      await verifyAndApplyMercadoPagoPreapprovalById(resourceId);
    } else {
      await verifyAndApplyMercadoPagoPaymentById(resourceId);
    }
    return NextResponse.json({ ok: true });
  } catch {
    // webhook should not retry forever because of transient app errors
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
