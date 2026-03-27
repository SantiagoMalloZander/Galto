'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, Loader2, LogOut, Phone, Send, Target, Users, XCircle } from 'lucide-react';

type SendResult = {
  summary: { total: number; sent: number; failed: number };
  results: Array<{ phone: string; name: string | null; ok: boolean; error?: string }>;
};

export default function WppPanelPage() {
  const router = useRouter();
  const [rawContacts, setRawContacts] = useState('');
  const [message, setMessage] = useState(
    `Hola! ¿Cómo estás?

Estamos abriendo cupo para solo 3 peluquerías que quieran probar Galto en esta etapa inicial 🚀

Galto es un sistema específico para peluquerías que incluye agenda online, organización de clientes, recordatorios automáticos y una AI predictiva que analiza el comportamiento de tus propios clientes para llenar los huecos de tu calendario sin depender de publicidad paga.

La idea no es traer más gente todo el tiempo, sino hacer que vuelvan los que ya te conocen.

Podés ver más en 👉 https://galto.online

Son solo 3 lugares y realmente puede aportar muchísimo valor a tu negocio por apenas unos minutos para que lo veas funcionando.

Si te interesa, coordinamos y te lo muestro.`,
  );
  const [campaignName, setCampaignName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const parsedContacts = useMemo(() => {
    const lines = rawContacts
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((line) => {
      if (!line.includes(',')) return { name: null as string | null, phone: line };
      const [name, ...rest] = line.split(',');
      return { name: name.trim() || null, phone: rest.join(',').trim() };
    });
  }, [rawContacts]);

  async function handleSend() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/wpp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: campaignName.trim() || null,
          message,
          contacts: parsedContacts,
        }),
      });
      const payload = await response.json().catch(() => ({} as any));
      if (response.status === 401) {
        router.replace('/wpp/login');
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo enviar');
      }
      setResult(payload as SendResult);
    } catch (err: any) {
      setError(err?.message ?? 'Error enviando');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/wpp/logout', { method: 'POST' }).catch(() => null);
    router.replace('/wpp/login');
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">WPP Prospector</h1>
          <p className="text-muted-foreground">Panel privado para prospección por WhatsApp (Evolution API).</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Salir
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Campaña
          </CardTitle>
          <CardDescription>
            Podés usar <span className="font-mono">{'{{nombre}}'}</span> para personalizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre de campaña (opcional)</label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ej: Reactivación jueves"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cantidad de contactos</label>
              <div className="h-10 rounded-md border bg-muted/30 px-3 flex items-center text-sm text-muted-foreground">
                <Users className="h-4 w-4 mr-2" />
                {parsedContacts.length} contacto(s)
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Contactos (uno por línea)</label>
              <Textarea
                value={rawContacts}
                onChange={(e) => setRawContacts(e.target.value)}
                rows={12}
                placeholder={'+5491123401136\nJuan,+5491166677788\n+5491133344455'}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Formatos: <span className="font-medium">1147472282</span>, <span className="font-medium">+54911...</span> o <span className="font-medium">Nombre,1147472282</span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mensaje</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={12}
                placeholder="Escribí el mensaje..."
              />
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Canal: Evolution API</Badge>
                <Badge variant="outline">Variable: {'{{nombre}}'}</Badge>
              </div>
            </div>
          </div>

          <Button onClick={handleSend} disabled={loading || !message.trim() || parsedContacts.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar campaña
          </Button>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground">Total</p>
                  <p className="text-2xl font-semibold">{result.summary.total}</p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-semibold text-emerald-600">{result.summary.sent}</p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground">Fallidos</p>
                  <p className="text-2xl font-semibold text-rose-600">{result.summary.failed}</p>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="max-h-72 overflow-auto divide-y">
                  {result.results.map((item, index) => (
                    <div key={`${item.phone}-${index}`} className="px-3 py-2 text-sm flex items-center gap-2">
                      {item.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      )}
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{item.phone}</span>
                      {item.name ? <span className="text-muted-foreground">({item.name})</span> : null}
                      {!item.ok && item.error ? (
                        <span className="text-rose-600 text-xs ml-auto">{item.error}</span>
                      ) : (
                        <span className="text-emerald-600 text-xs ml-auto">OK</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
