'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CalendarClock, Crown, ExternalLink, Medal, Plus, RefreshCcw, Trophy, Upload, Video } from 'lucide-react';
import { getStoredAuthSession } from '@/lib/auth';

type Tenant = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

type ContentContext = {
  actor: {
    membershipId: string;
    role: 'OWNER' | 'MANAGER' | 'EMPLOYEE' | string;
    canManageCompetition: boolean;
    canSubmit: boolean;
  };
  activeCompetition: {
    id: string;
    title: string;
    prizeText: string;
    notes: string | null;
    startsAt: string;
    deadlineAt: string;
    status: 'ACTIVE' | 'CLOSED';
    createdAt: string;
  } | null;
  ranking: Array<{
    submissionId: string;
    membershipId: string;
    platform: 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK';
    videoUrl: string;
    views: number;
    role: string;
    name: string;
    updatedAt: string;
    position: number;
  }>;
  mySubmission: {
    submissionId: string;
    platform: 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK';
    videoUrl: string;
    views: number;
  } | null;
  competitions: Array<{
    id: string;
    title: string;
    prizeText: string;
    notes: string | null;
    startsAt: string;
    deadlineAt: string;
    status: 'ACTIVE' | 'CLOSED';
    createdAt: string;
  }>;
};

function toDatetimeLocalDefault(daysAhead = 7) {
  const value = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  const hh = String(value.getHours()).padStart(2, '0');
  const min = String(value.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function asIsoFromDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function formatRemaining(deadlineIso: string) {
  const diff = new Date(deadlineIso).getTime() - Date.now();
  if (diff <= 0) return 'Finalizado';
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  return `${hours}h ${mins}m`;
}

function progressPct(startsAtIso: string, deadlineIso: string) {
  const start = new Date(startsAtIso).getTime();
  const end = new Date(deadlineIso).getTime();
  const now = Date.now();
  if (end <= start) return 100;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

function platformLabel(platform: 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK') {
  if (platform === 'INSTAGRAM') return 'Instagram';
  if (platform === 'TIKTOK') return 'TikTok';
  return 'Facebook';
}

export default function ContenidoPage() {
  const [session] = useState(() => getStoredAuthSession());
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [context, setContext] = useState<ContentContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [competitionTitle, setCompetitionTitle] = useState('');
  const [competitionPrize, setCompetitionPrize] = useState('');
  const [competitionDeadlineLocal, setCompetitionDeadlineLocal] = useState(toDatetimeLocalDefault(7));
  const [competitionNotes, setCompetitionNotes] = useState('');

  const [submissionPlatform, setSubmissionPlatform] = useState<'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK'>('INSTAGRAM');
  const [submissionVideoUrl, setSubmissionVideoUrl] = useState('');

  const selectedTenant = useMemo(() => tenants.find((row) => row.tenantId === tenantId) ?? null, [tenants, tenantId]);
  const activeCompetition = context?.activeCompetition ?? null;
  const activeProgress = activeCompetition ? progressPct(activeCompetition.startsAt, activeCompetition.deadlineAt) : 0;

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    const loadTenants = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/reservas/tenants?userId=${encodeURIComponent(session.user.id)}`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron cargar negocios');
        const list = (payload?.tenants ?? []) as Tenant[];
        setTenants(list);
        if (list[0]?.tenantId) setTenantId(list[0].tenantId);
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando negocios');
      } finally {
        setLoading(false);
      }
    };
    void loadTenants();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !tenantId) return;
    void loadContext(tenantId);
  }, [tenantId, session?.user?.id]);

  useEffect(() => {
    if (!context?.mySubmission) return;
    setSubmissionPlatform(context.mySubmission.platform);
    setSubmissionVideoUrl(context.mySubmission.videoUrl);
  }, [context?.mySubmission]);

  async function loadContext(targetTenantId: string) {
    if (!session?.user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/contenido/context?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(targetTenantId)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar contenido');
      setContext(payload as ContentContext);
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando contenido');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCompetition() {
    if (!session?.user?.id || !tenantId) return;
    const deadlineAt = asIsoFromDatetimeLocal(competitionDeadlineLocal);
    if (!deadlineAt) {
      setError('Deadline inválido');
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch('/api/contenido/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          title: competitionTitle,
          prizeText: competitionPrize,
          deadlineAt,
          notes: competitionNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo crear la competencia');
      setCompetitionTitle('');
      setCompetitionPrize('');
      setCompetitionDeadlineLocal(toDatetimeLocalDefault(7));
      setCompetitionNotes('');
      setStatus('Competencia creada.');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error creando competencia');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitVideo() {
    if (!session?.user?.id || !tenantId || !activeCompetition) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/contenido/competitions/${encodeURIComponent(activeCompetition.id)}/submissions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user.id,
            tenantId,
            platform: submissionPlatform,
            videoUrl: submissionVideoUrl,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo guardar el video');
      setStatus(
        payload?.warning
          ? String(payload.warning)
          : 'Video guardado en la competencia con visitas leídas automáticamente.',
      );
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando video');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando panel de contenido...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Panel de contenido</h1>
          <p className="text-muted-foreground">Torneos de videos del equipo y ranking por visitas.</p>
        </div>
        <div className="rounded-md border bg-muted/30 p-3 min-w-[260px]">
          <p className="text-xs text-muted-foreground">Negocio activo</p>
          <p className="text-sm font-medium">
            {selectedTenant ? `${selectedTenant.tenantName} (${selectedTenant.tenantSlug})` : 'Sin negocio'}
          </p>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {status ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{status}</div> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Negocio</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          >
            {tenants.map((tenant) => (
              <option key={tenant.tenantId} value={tenant.tenantId}>
                {tenant.tenantName} ({tenant.tenantSlug})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {activeCompetition ? (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-white to-white">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{activeCompetition.title}</CardTitle>
              <Badge>Activa</Badge>
            </div>
            <CardDescription>{activeCompetition.prizeText}</CardDescription>
            {activeCompetition.notes ? <p className="text-sm text-muted-foreground">{activeCompetition.notes}</p> : null}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Cierra: {formatDate(activeCompetition.deadlineAt)}
              </span>
              <span>Falta: {formatRemaining(activeCompetition.deadlineAt)}</span>
            </div>
            <Progress value={activeProgress} />
            <p className="text-xs text-muted-foreground">
              Progreso del torneo: {Math.round(activeProgress)}% transcurrido.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            No hay torneo activo en este momento.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {context?.actor.canManageCompetition ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Crear competencia
              </CardTitle>
              <CardDescription>Owner o Manager abre un torneo y define el premio (texto).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={competitionTitle} onChange={(e) => setCompetitionTitle(e.target.value)} placeholder="Ej: Torneo Marzo" />
              </div>
              <div className="space-y-2">
                <Label>Premio (texto)</Label>
                <Input value={competitionPrize} onChange={(e) => setCompetitionPrize(e.target.value)} placeholder="Ej: Día libre + bono especial" />
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input type="datetime-local" value={competitionDeadlineLocal} onChange={(e) => setCompetitionDeadlineLocal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea rows={3} value={competitionNotes} onChange={(e) => setCompetitionNotes(e.target.value)} />
              </div>
              <Button
                onClick={handleCreateCompetition}
                disabled={saving || !competitionTitle.trim() || !competitionPrize.trim()}
                className="w-full md:w-auto"
              >
                Crear torneo
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Cargar tu video
            </CardTitle>
            <CardDescription>Empleados y managers pueden subir su link y actualizar visitas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeCompetition && context?.actor.canSubmit ? (
              <>
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={submissionPlatform}
                    onChange={(e) => setSubmissionPlatform(e.target.value as 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK')}
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="FACEBOOK">Facebook</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Link del video</Label>
                  <Input
                    value={submissionVideoUrl}
                    onChange={(e) => setSubmissionVideoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Las visitas se leen automáticamente desde el link. Si cambian, podés volver a guardar o refrescar el panel.
                </p>
                <Button onClick={handleSubmitVideo} disabled={saving || !submissionVideoUrl.trim()} className="w-full md:w-auto">
                  Guardar video
                </Button>
                <Button variant="outline" onClick={() => void loadContext(tenantId)} className="w-full md:w-auto">
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Refrescar visitas
                </Button>
              </>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Cuando haya torneo activo vas a poder cargar tu video acá.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="h-5 w-5" />
            Ranking por visitas
          </CardTitle>
          <CardDescription>Gana el video con más visitas al cierre de la deadline.</CardDescription>
        </CardHeader>
        <CardContent>
          {(context?.ranking?.length ?? 0) === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Todavía no hay videos cargados en el torneo activo.
            </div>
          ) : (
            <div className="space-y-2">
              {context?.ranking.map((row) => {
                const isMe = row.membershipId === context.actor.membershipId;
                return (
                  <div
                    key={row.submissionId}
                    className={`rounded-lg border p-3 flex items-center gap-3 ${
                      isMe ? 'border-primary/40 bg-primary/5' : ''
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-xs font-semibold">
                      {row.position}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate flex items-center gap-2">
                        {row.name}
                        {row.role === 'OWNER' ? <Crown className="h-3.5 w-3.5 text-amber-600" /> : null}
                        {isMe ? <Badge variant="secondary">Tu video</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {platformLabel(row.platform)} · actualizado {formatDate(row.updatedAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">{row.views.toLocaleString('es-AR')}</p>
                      <p className="text-xs text-muted-foreground">visitas</p>
                    </div>
                    <a
                      href={row.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
                      title="Abrir video"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Historial de torneos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(context?.competitions ?? []).map((competition) => (
            <div key={competition.id} className="rounded-md border p-3">
              <p className="text-sm font-semibold">{competition.title}</p>
              <p className="text-xs text-muted-foreground">
                Premio: {competition.prizeText} · Deadline: {formatDate(competition.deadlineAt)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
