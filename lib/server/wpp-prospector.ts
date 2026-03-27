export function normalizePhone(input: string) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/\D/g, '');

  // Formato local AR típico (Google Maps/export): 10/11 dígitos sin prefijo país.
  // Ej: 1147472282 -> +541147472282
  if (digits.length === 10 || digits.length === 11) {
    if (!digits.startsWith('54')) {
      digits = `54${digits}`;
    }
  }

  // Limpieza de casos con 0 inicial local.
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

export async function sendEvolutionText(input: { phone: string; text: string }) {
  const baseUrl = (process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
  const instance = process.env.EVOLUTION_INSTANCE_NAME ?? 'Santiago_Galto';
  const apiKey = process.env.EVOLUTION_API_KEY ?? '';

  if (!apiKey) {
    throw new Error('Falta EVOLUTION_API_KEY');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    signal: controller.signal,
    body: JSON.stringify({
      number: input.phone.replace(/\D/g, ''),
      text: input.text,
    }),
  });
  clearTimeout(timeout);

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    const lowMsg = String(payload?.message ?? payload?.error ?? payload?.response?.message ?? '').toLowerCase();
    if (lowMsg.includes('connection closed') || lowMsg.includes('logged out') || lowMsg.includes('unauthorized')) {
      throw new Error('Evolution está desconectado. Entrá a Evolution Manager y reconectá la instancia escaneando QR.');
    }
    throw new Error(payload?.message ?? payload?.error ?? payload?.response?.message ?? 'Error enviando mensaje');
  }

  return payload;
}

export async function getEvolutionConnectionState() {
  const baseUrl = (process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
  const instance = process.env.EVOLUTION_INSTANCE_NAME ?? 'Santiago_Galto';
  const apiKey = process.env.EVOLUTION_API_KEY ?? '';
  if (!apiKey) throw new Error('Falta EVOLUTION_API_KEY');

  const response = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`, {
    method: 'GET',
    headers: { apikey: apiKey },
  });
  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    throw new Error(payload?.message ?? 'No se pudo consultar estado de Evolution');
  }
  return String(payload?.instance?.state ?? '').toLowerCase();
}
