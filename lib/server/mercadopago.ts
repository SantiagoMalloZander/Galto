const MP_API_BASE = process.env.MERCADOPAGO_API_BASE_URL?.trim() || 'https://api.mercadopago.com';

function getAccessToken() {
  return process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || '';
}

export function getMercadoPagoPublicKey() {
  return process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || process.env.MERCADOPAGO_PUBLIC_KEY?.trim() || null;
}

export function hasMercadoPagoConfig() {
  return Boolean(getAccessToken());
}

function parseBool(raw: string | undefined, fallback: boolean) {
  if (!raw) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes') return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  return fallback;
}

export function isMercadoPagoRecurrenceEnabled() {
  return parseBool(process.env.MERCADOPAGO_ENABLE_RECURRENCE, true);
}

export async function createMercadoPagoPreference(input: {
  externalReference: string;
  title: string;
  amountArs: number;
  payerEmail?: string | null;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
  }

  const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      external_reference: input.externalReference,
      items: [
        {
          title: input.title,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: Number(input.amountArs),
        },
      ],
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      back_urls: {
        success: input.successUrl,
        failure: input.failureUrl,
        pending: input.pendingUrl,
      },
      auto_return: 'approved',
      notification_url: input.notificationUrl || undefined,
      metadata: input.metadata,
    }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    const message = payload?.message || payload?.error || 'No se pudo crear preferencia de Mercado Pago';
    throw new Error(message);
  }

  return {
    id: String(payload.id),
    initPoint: String(payload.init_point || ''),
    sandboxInitPoint: String(payload.sandbox_init_point || ''),
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
  }

  const response = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    const message = payload?.message || payload?.error || 'No se pudo verificar el pago en Mercado Pago';
    throw new Error(message);
  }

  return {
    id: String(payload.id),
    status: String(payload.status || ''),
    statusDetail: String(payload.status_detail || ''),
    externalReference: String(payload.external_reference || ''),
    metadata: (payload.metadata ?? {}) as Record<string, unknown>,
  };
}

export async function getMercadoPagoPreapproval(preapprovalId: string) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
  }

  const response = await fetch(`${MP_API_BASE}/preapproval/${encodeURIComponent(preapprovalId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    const message = payload?.message || payload?.error || 'No se pudo verificar la suscripción en Mercado Pago';
    throw new Error(message);
  }

  return {
    id: String(payload.id),
    status: String(payload.status || ''),
    externalReference: String(payload.external_reference || ''),
  };
}

export async function createMercadoPagoPreapproval(input: {
  externalReference: string;
  reason: string;
  amountArs: number;
  payerEmail: string;
  backUrl: string;
  status?: 'authorized' | 'pending';
}) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
  }

  const startDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(`${MP_API_BASE}/preapproval`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      status: input.status ?? 'pending',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: Number(input.amountArs),
        currency_id: 'ARS',
        start_date: startDate,
        end_date: endDate,
      },
    }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    const message = payload?.message || payload?.error || 'No se pudo crear suscripción de Mercado Pago';
    throw new Error(message);
  }

  return {
    id: String(payload.id),
    initPoint: String(payload.init_point || ''),
    status: String(payload.status || ''),
  };
}
