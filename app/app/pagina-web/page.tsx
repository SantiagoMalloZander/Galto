'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Copy, Globe, Upload, X } from 'lucide-react'
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
  }
  schedules: ScheduleRow[]
}

export default function PaginaWebReservasPage() {
  const [session] = useState(() => getStoredAuthSession())
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [branches, setBranches] = useState<BranchSummary[]>([])
  const [branchId, setBranchId] = useState('')
  const [config, setConfig] = useState<BranchConfig | null>(null)
  const [domain, setDomain] = useState<{
    isPaid: boolean
    bookingUrl: string | null
    paymentStatus: 'DEMO_ACTIVE' | 'PENDING' | 'CONFIRMED' | 'NONE' | string
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [clientOrigin, setClientOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setClientOrigin(window.location.origin)
    }
  }, [])

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
          setDomain(null)
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

      const nextConfig = payload.config as BranchConfig
      setConfig({
        ...nextConfig,
        profile: {
          ...nextConfig.profile,
          showServicePrices: nextConfig.profile?.showServicePrices ?? true,
        },
      })
      setDomain(payload.domain ?? null)
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando configuración')
    }
  }

async function saveWebConfig() {
    if (!tenantId || !branchId || !config || !session?.user?.id) return
    if (!config.branch.name.trim()) {
      setError('El nombre del negocio/sucursal no puede estar vacío para guardar.')
      return
    }

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
          profile: config.profile,
          schedules: config.schedules,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo guardar configuración visual')

      const nextConfig = payload.config as BranchConfig
      setConfig({
        ...nextConfig,
        profile: {
          ...nextConfig.profile,
          showServicePrices: nextConfig.profile?.showServicePrices ?? true,
        },
      })
      setMessage('Página web actualizada')
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando página web')
    } finally {
      setSaving(false)
    }
  }

  async function handleSingleImageUpload(field: 'profilePhotoUrl' | 'bannerPhotoUrl', file: File | null) {
    if (!config || !file) return
    const dataUrl = await fileToDataUrl(file)
    setConfig({
      ...config,
      profile: {
        ...config.profile,
        [field]: dataUrl,
      },
    })
  }

  async function handleTenantImageUpload(field: 'logoPhotoUrl' | 'bannerPhotoUrl', file: File | null) {
    if (!config || !file) return
    const dataUrl = await fileToDataUrl(file)
    setConfig({
      ...config,
      tenantVisual: {
        ...config.tenantVisual,
        [field]: dataUrl,
      },
    })
  }

  async function handleCarouselUpload(files: FileList | null) {
    if (!config || !files || files.length === 0) return
    const nextUrls: string[] = []
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file)
      nextUrls.push(dataUrl)
    }

    setConfig({
      ...config,
      profile: {
        ...config.profile,
        carouselPhotoUrls: [...config.profile.carouselPhotoUrls, ...nextUrls],
      },
    })
  }

  function removeCarouselPhoto(index: number) {
    if (!config) return
    const next = [...config.profile.carouselPhotoUrls]
    next.splice(index, 1)
    setConfig({
      ...config,
      profile: {
        ...config.profile,
        carouselPhotoUrls: next,
      },
    })
  }

  async function copyText(value: string, successMessage: string) {
    const safeValue = ensurePublicUrl(value, clientOrigin)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(safeValue)
        setMessage(successMessage)
        void markOnboardingStep('createBooking')
        return
      } catch {
        // fallback below
      }
    }

    if (legacyCopy(safeValue)) {
      setMessage(successMessage)
      void markOnboardingStep('createBooking')
      return
    }

    setMessage(`Copiá manualmente: ${safeValue}`)
  }

  const selectedTenant = useMemo(() => tenants.find((tenant) => tenant.tenantId === tenantId), [tenants, tenantId])
  async function markOnboardingStep(stepId: 'createBooking') {
    if (!session?.user?.id || !tenantId) return
    try {
      await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          stepId,
          completed: true,
        }),
      })
      window.dispatchEvent(
        new CustomEvent('galto-onboarding-updated', {
          detail: { tenantId },
        }),
      )
    } catch {
      // keep UX even if onboarding sync fails
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando configuración de página web...</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Página web de reservas</h1>
        <p className="text-muted-foreground">
          Configurá solo lo visual y público de la web de reservas de cada sucursal.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Negocio, sucursal y dominio público</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
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
          </div>

          <div className="rounded-md border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="text-sm font-medium">Dominio público de reservas</span>
              <Badge variant={domain?.isPaid || domain?.paymentStatus === 'DEMO_ACTIVE' ? 'default' : 'secondary'}>
                {domain?.isPaid
                  ? 'Activo por pago'
                  : domain?.paymentStatus === 'DEMO_ACTIVE'
                    ? 'Activo en plan gratis'
                    : domain?.paymentStatus === 'PENDING'
                      ? 'Pago pendiente'
                      : 'Inactivo'}
              </Badge>
            </div>

            {domain?.bookingUrl ? (
              <div className="flex gap-2">
                <Input readOnly value={ensurePublicUrl(domain.bookingUrl, clientOrigin)} />
                <Button variant="outline" onClick={() => void copyText(domain.bookingUrl || '', 'Link público copiado.')} data-guide-booking-copy-link="1">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                El dominio se habilita cuando el tenant tiene plan pago confirmado.
              </p>
            )}

            {selectedTenant ? (
              <p className="text-xs text-muted-foreground">Dominio esperado: {selectedTenant.tenantSlug}.galto.online</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {config ? (
        <Card>
          <CardHeader>
            <CardTitle>Contenido visual de la web</CardTitle>
            <CardDescription>
              Separado por niveles: marca del negocio (tenant) y contenido propio de cada sucursal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md border p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Marca del negocio (tenant)</h3>
                <p className="text-xs text-muted-foreground">Esto se comparte en todas las sucursales del negocio.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label>Logo del negocio (tenant)</Label>
                  <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/60" data-guide-booking-tenant-logo="1">
                    <Upload className="h-4 w-4" />
                    Subir logo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleTenantImageUpload('logoPhotoUrl', e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {config.tenantVisual.logoPhotoUrl ? (
                    <img src={config.tenantVisual.logoPhotoUrl} alt="Logo del negocio" className="h-36 w-full object-cover rounded-md border" />
                  ) : (
                    <div className="h-36 w-full rounded-md border border-dashed text-sm text-muted-foreground grid place-items-center">
                      Sin logo del negocio
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Banner del negocio (tenant)</Label>
                  <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/60">
                    <Upload className="h-4 w-4" />
                    Subir banner
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleTenantImageUpload('bannerPhotoUrl', e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {config.tenantVisual.bannerPhotoUrl ? (
                    <img src={config.tenantVisual.bannerPhotoUrl} alt="Banner del negocio" className="h-36 w-full object-cover rounded-md border" />
                  ) : (
                    <div className="h-36 w-full rounded-md border border-dashed text-sm text-muted-foreground grid place-items-center">
                      Sin banner del negocio
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nota pública de la sucursal</Label>
              <Textarea
                value={config.profile.publicNote ?? ''}
                onChange={(e) => setConfig({ ...config, profile: { ...config.profile, publicNote: e.target.value } })}
                placeholder="Mensaje público para tus clientes"
              />
            </div>

            <div className="rounded-md border p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={config.profile.showServicePrices ?? true}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      profile: { ...config.profile, showServicePrices: e.target.checked },
                    })
                  }
                />
                <span>
                  <span className="block text-sm font-medium">Mostrar precio en la lista de servicios</span>
                  <span className="block text-xs text-muted-foreground">
                    Si lo desactivás, en la web pública se verán nombre y duración sin precio.
                  </span>
                </span>
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Foto de perfil de la sucursal</Label>
                <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/60">
                  <Upload className="h-4 w-4" />
                  Subir imagen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleSingleImageUpload('profilePhotoUrl', e.target.files?.[0] ?? null)}
                  />
                </label>
                {config.profile.profilePhotoUrl ? (
                  <img src={config.profile.profilePhotoUrl} alt="Foto de perfil" className="h-36 w-full object-cover rounded-md border" />
                ) : (
                  <div className="h-36 w-full rounded-md border border-dashed text-sm text-muted-foreground grid place-items-center">
                    Sin foto de perfil
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>Banner de la sucursal</Label>
                <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/60">
                  <Upload className="h-4 w-4" />
                  Subir imagen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleSingleImageUpload('bannerPhotoUrl', e.target.files?.[0] ?? null)}
                  />
                </label>
                {config.profile.bannerPhotoUrl ? (
                  <img src={config.profile.bannerPhotoUrl} alt="Foto de banner" className="h-36 w-full object-cover rounded-md border" />
                ) : (
                  <div className="h-36 w-full rounded-md border border-dashed text-sm text-muted-foreground grid place-items-center">
                    Sin banner
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Carrusel de fotos</Label>
              <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/60">
                <Upload className="h-4 w-4" />
                Subir imágenes
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleCarouselUpload(e.target.files)}
                />
              </label>

              {config.profile.carouselPhotoUrls.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">Sin fotos en carrusel.</div>
              ) : (
                <div className="grid md:grid-cols-3 gap-3">
                  {config.profile.carouselPhotoUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative rounded-md overflow-hidden">
                      <img src={url} alt={`Carrusel ${index + 1}`} className="h-32 w-full object-cover" />
                      <button
                        className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white"
                        onClick={() => removeCarouselPhoto(index)}
                        type="button"
                        aria-label="Quitar foto"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={saveWebConfig} disabled={saving}>Guardar página web</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

function legacyCopy(value: string) {
  if (typeof document === 'undefined') return false
  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}

function ensurePublicOrigin(origin: string) {
  const envPublic = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  const fallback = envPublic || (typeof window !== 'undefined' ? window.location.origin : '')
  const candidate = (origin || fallback).replace(/\/+$/, '')
  if (!candidate) return ''

  try {
    const parsed = new URL(candidate)
    const isIpV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0' || isIpV4) {
      return fallback || candidate
    }
    return candidate
  } catch {
    return fallback || candidate
  }
}

function ensurePublicUrl(url: string, fallbackOrigin: string) {
  if (!url) return ''
  const safeOrigin = ensurePublicOrigin(fallbackOrigin)
  try {
    const parsed = new URL(url, safeOrigin || undefined)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0') {
      if (safeOrigin) {
        const fallback = new URL(safeOrigin)
        parsed.protocol = fallback.protocol
        parsed.host = fallback.host
      }
    }
    return parsed.toString()
  } catch {
    return url
  }
}
