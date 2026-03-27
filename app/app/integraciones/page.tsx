'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, MessageCircle, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getStoredAuthSession } from '@/lib/auth'

type AssignmentStrategy = 'ROTATIVE' | 'LOAD_BALANCE' | 'FIRST_AVAILABLE' | 'BEST_RATED'

type Tenant = {
  tenantId: string
  tenantSlug: string
  tenantName: string
}

type BranchSummary = {
  id: string
  name: string
  slug: string
  timeZone: string
  allowChooseEmployee: boolean
  assignmentStrategy: AssignmentStrategy
}

type ScheduleRow = {
  dayOfWeek: number
  startTimeMin: number
  endTimeMin: number
}

type BranchConfig = {
  branch: BranchSummary
  tenantVisual: {
    logoPhotoUrl: string | null
    bannerPhotoUrl: string | null
  }
  profile: {
    address: string | null
    phone: string | null
    showServicePrices: boolean
    policyText: string | null
    cancellationEnabled: boolean
    depositType: 'NONE' | 'PERCENTAGE' | 'FIXED'
    depositAmount: number
    publicNote: string | null
    profilePhotoUrl: string | null
    bannerPhotoUrl: string | null
    carouselPhotoUrls: string[]
    useCustomWhatsappApi: boolean
    whatsappMetaAccessToken: string | null
    whatsappMetaPhoneNumberId: string | null
    whatsappMetaGraphVersion: string | null
    whatsappMetaOtpTemplateName: string | null
    whatsappMetaOtpTemplateLang: string | null
    mercadoPagoPublicKey: string | null
    mercadoPagoAccessToken: string | null
    chatgptApiKey: string | null
  }
  schedules: ScheduleRow[]
}

export default function IntegracionesPage() {
  const [session] = useState(() => getStoredAuthSession())
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [branches, setBranches] = useState<BranchSummary[]>([])
  const [branchId, setBranchId] = useState('')
  const [config, setConfig] = useState<BranchConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return

    ;(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/reservas/tenants?userId=${encodeURIComponent(session.user.id)}`)
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron cargar negocios')

        const nextTenants = (payload?.tenants ?? []) as Tenant[]
        setTenants(nextTenants)
        if (nextTenants[0]?.tenantId) setTenantId(nextTenants[0].tenantId)
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando negocios')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!tenantId || !session?.user?.id) return

    ;(async () => {
      try {
        const response = await fetch(
          `/api/reservas/branches?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(tenantId)}`,
        )
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron cargar sucursales')

        const list = (payload?.branches ?? []) as BranchSummary[]
        setBranches(list)
        if (!branchId && list[0]?.id) setBranchId(list[0].id)
        if (list.length === 0) {
          setConfig(null)
        }
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando sucursales')
      }
    })()
  }, [tenantId])

  useEffect(() => {
    if (!tenantId || !branchId || !session?.user?.id) return
    void loadConfig(tenantId, branchId)
  }, [tenantId, branchId])

  async function loadConfig(nextTenantId: string, nextBranchId: string) {
    try {
      const response = await fetch(
        `/api/reservas/branches/${nextBranchId}/config?userId=${encodeURIComponent(session!.user.id)}&tenantId=${encodeURIComponent(nextTenantId)}`,
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar configuración')
      setConfig(payload.config as BranchConfig)
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando configuración')
    }
  }

  async function saveIntegrations() {
    if (!tenantId || !branchId || !config || !session?.user?.id) return

    const hasWhatsappCredentials = Boolean(
      (config.profile.whatsappMetaPhoneNumberId ?? '').trim() &&
        (config.profile.whatsappMetaAccessToken ?? '').trim(),
    )

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/reservas/branches/${branchId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          branch: config.branch,
          tenantVisual: config.tenantVisual,
          profile: {
            ...config.profile,
            useCustomWhatsappApi: hasWhatsappCredentials,
          },
          schedules: config.schedules,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron guardar integraciones')

      setConfig(payload.config as BranchConfig)
      setMessage('Integraciones guardadas.')
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando integraciones')
    } finally {
      setSaving(false)
    }
  }

  const whatsappConfigured = useMemo(
    () =>
      Boolean(
        (config?.profile.whatsappMetaPhoneNumberId ?? '').trim() &&
          (config?.profile.whatsappMetaAccessToken ?? '').trim(),
      ),
    [config?.profile.whatsappMetaPhoneNumberId, config?.profile.whatsappMetaAccessToken],
  )
  const mercadoPagoConfigured = useMemo(
    () =>
      Boolean(
        (config?.profile.mercadoPagoPublicKey ?? '').trim() &&
          (config?.profile.mercadoPagoAccessToken ?? '').trim(),
      ),
    [config?.profile.mercadoPagoPublicKey, config?.profile.mercadoPagoAccessToken],
  )
  const chatgptConfigured = useMemo(
    () => Boolean((config?.profile.chatgptApiKey ?? '').trim()),
    [config?.profile.chatgptApiKey],
  )

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando integraciones...</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Integraciones</h1>
        <p className="text-muted-foreground">Conectá herramientas del negocio para automatizar comunicación, cobros y bot.</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Negocio y sucursal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Negocio (tenant)</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value)
                setBranchId('')
              }}
            >
              {tenants.map((tenant) => (
                <option key={tenant.tenantId} value={tenant.tenantId}>
                  {tenant.tenantName} ({tenant.tenantSlug})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Sucursal</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.slug})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {config ? (
        <Card>
          <CardHeader>
            <CardTitle>Herramientas conectadas al negocio</CardTitle>
            <CardDescription>
              Estas integraciones se usan para operar de forma automática según la configuración de tu sucursal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-semibold">WPP</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Lo usamos para mandar mensajes de recontacto completamente personalizados y ofertas irresistibles.
                </p>
                <Badge variant={whatsappConfigured ? 'default' : 'secondary'}>
                  {whatsappConfigured ? 'Conectado' : 'Pendiente'}
                </Badge>
              </div>

              <div className="rounded-md border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-sky-600" />
                  <p className="text-sm font-semibold">Mercado Pago</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Para cobrar la seña si así lo indica la configuración de su negocio.
                </p>
                <Badge variant={mercadoPagoConfigured ? 'default' : 'secondary'}>
                  {mercadoPagoConfigured ? 'Conectado' : 'Pendiente'}
                </Badge>
              </div>

              <div className="rounded-md border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-violet-600" />
                  <p className="text-sm font-semibold">ChatGPT</p>
                </div>
                <p className="text-sm text-muted-foreground">Lo usamos para el bot y automatizaciones conversacionales del negocio.</p>
                <Badge variant={chatgptConfigured ? 'default' : 'secondary'}>
                  {chatgptConfigured ? 'Conectado' : 'Pendiente'}
                </Badge>
              </div>
            </div>

            <div className="rounded-md border p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Configuración de WhatsApp Business API</h3>
                <p className="text-xs text-muted-foreground">
                  Cargá estos datos para enviar mensajes desde el número del negocio.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Phone Number ID</Label>
                  <Input
                    value={config.profile.whatsappMetaPhoneNumberId ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, whatsappMetaPhoneNumberId: e.target.value },
                      })
                    }
                    placeholder="1072353582626637"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Graph version</Label>
                  <Input
                    value={config.profile.whatsappMetaGraphVersion ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, whatsappMetaGraphVersion: e.target.value },
                      })
                    }
                    placeholder="v21.0"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Access Token</Label>
                  <Input
                    type="password"
                    value={config.profile.whatsappMetaAccessToken ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, whatsappMetaAccessToken: e.target.value },
                      })
                    }
                    placeholder="EAA..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Template OTP (opcional)</Label>
                  <Input
                    value={config.profile.whatsappMetaOtpTemplateName ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, whatsappMetaOtpTemplateName: e.target.value },
                      })
                    }
                    placeholder="otp_login"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Idioma template OTP</Label>
                  <Input
                    value={config.profile.whatsappMetaOtpTemplateLang ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, whatsappMetaOtpTemplateLang: e.target.value },
                      })
                    }
                    placeholder="es_AR"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Credenciales de Mercado Pago</h3>
                <p className="text-xs text-muted-foreground">
                  Guardamos estas claves para habilitar cobro de seña desde el negocio.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Public Key</Label>
                  <Input
                    value={config.profile.mercadoPagoPublicKey ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, mercadoPagoPublicKey: e.target.value },
                      })
                    }
                    placeholder="APP_USR-..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Access Token</Label>
                  <Input
                    type="password"
                    value={config.profile.mercadoPagoAccessToken ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, mercadoPagoAccessToken: e.target.value },
                      })
                    }
                    placeholder="APP_USR-..."
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Credenciales de ChatGPT</h3>
                <p className="text-xs text-muted-foreground">
                  Esta clave se usa para activar el bot y respuestas inteligentes del negocio.
                </p>
              </div>
              <div className="space-y-1">
                <Label>OpenAI API Key</Label>
                <Input
                  type="password"
                  value={config.profile.chatgptApiKey ?? ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      profile: { ...config.profile, chatgptApiKey: e.target.value },
                    })
                  }
                  placeholder="sk-..."
                />
              </div>
            </div>

            <Button onClick={saveIntegrations} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar integraciones'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
