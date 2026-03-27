'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getStoredAuthSession } from '@/lib/auth'
import { ChevronDown, ChevronRight, Edit2, Plus, Trash2, Upload } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

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
  profile: {
    address: string | null
    phone: string | null
    policyText: string | null
    cancellationEnabled: boolean
    depositType: 'NONE' | 'PERCENTAGE' | 'FIXED'
    depositAmount: number
    publicNote: string | null
    profilePhotoUrl: string | null
    bannerPhotoUrl: string | null
    carouselPhotoUrls: string[]
  }
  schedules: ScheduleRow[]
  categories: Array<{ id: string; name: string }>
  services: Array<{
    id: string
    name: string
    durationMins: number
    priceCents: number
    isActive: boolean
    categoryName: string | null
    description: string | null
    imageUrl: string | null
    requiresDeposit: boolean
  }>
  employees: Array<{
    id: string
    fullName: string
    isActive: boolean
    serviceIds: string[]
    schedules: ScheduleRow[]
  }>
}

const DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, hour) => hour)
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => minute)
const DEFAULT_BRANCH_SCHEDULES: ScheduleRow[] = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  startTimeMin: 9 * 60,
  endTimeMin: 19 * 60,
}))

export default function InformacionNegocioPage() {
  const router = useRouter()
  const pathname = usePathname()
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

  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchSlug, setNewBranchSlug] = useState('')
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [depositAmountInput, setDepositAmountInput] = useState('0')
  const [showSchedules, setShowSchedules] = useState(true)
  const [showServices, setShowServices] = useState(true)
  const [configSnapshot, setConfigSnapshot] = useState('')
  const [initialServices, setInitialServices] = useState<BranchConfig['services']>([])
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null)
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null)

  const [serviceForm, setServiceForm] = useState({
    name: '',
    durationMins: '30',
    priceArs: '0',
    categoryName: '',
    description: '',
    imageUrl: '',
    requiresDeposit: false,
    isActive: true,
  })

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
  }, [session?.user?.id])

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
        if (list.length === 0) setConfig(null)
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando sucursales')
      }
    })()
  }, [tenantId, session?.user?.id, branchId])

  useEffect(() => {
    if (!tenantId || !branchId || !session?.user?.id) return
    void loadConfig(tenantId, branchId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchId, session?.user?.id])

  const activeTenantName = useMemo(
    () => tenants.find((tenant) => tenant.tenantId === tenantId)?.tenantName ?? 'Negocio',
    [tenants, tenantId],
  )

  const hasServiceFormDraft = useMemo(() => {
    return (
      editingServiceId !== null ||
      serviceForm.name.trim().length > 0 ||
      serviceForm.categoryName.trim().length > 0 ||
      serviceForm.description.trim().length > 0 ||
      serviceForm.imageUrl.trim().length > 0 ||
      serviceForm.durationMins !== '30' ||
      serviceForm.priceArs !== '0' ||
      serviceForm.requiresDeposit ||
      serviceForm.isActive !== true
    )
  }, [editingServiceId, serviceForm])

  const hasUnsavedChanges = useMemo(() => {
    if (!config) return false
    const currentSnapshot = serializeBranchConfig(config)
    const depositDraft = Number(depositAmountInput || 0) !== Number(config.profile.depositAmount || 0)
    return currentSnapshot !== configSnapshot || depositDraft || hasServiceFormDraft
  }, [config, configSnapshot, depositAmountInput, hasServiceFormDraft])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const onDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedChanges) return
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const link = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!link) return
      if (link.target && link.target !== '_self') return
      if (link.hasAttribute('download')) return

      const href = link.getAttribute('href') ?? ''
      if (!href || href.startsWith('#')) return

      const url = new URL(link.href, window.location.origin)
      if (url.origin !== window.location.origin) return
      if (url.pathname === pathname && url.search === window.location.search) return

      event.preventDefault()
      setPendingLeaveAction(() => null)
      setPendingLeaveHref(url.pathname + url.search + url.hash)
      setLeaveDialogOpen(true)
    }

    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [hasUnsavedChanges, pathname])

  async function loadConfig(nextTenantId: string, nextBranchId: string) {
    try {
      const response = await fetch(
        `/api/reservas/branches/${nextBranchId}/config?userId=${encodeURIComponent(session!.user.id)}&tenantId=${encodeURIComponent(nextTenantId)}`,
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar configuración')
      const nextConfig = payload.config as BranchConfig
      const hydratedConfig: BranchConfig = {
        ...nextConfig,
        schedules:
          nextConfig.schedules && nextConfig.schedules.length > 0
            ? nextConfig.schedules
            : DEFAULT_BRANCH_SCHEDULES.map((row) => ({ ...row })),
      }
      setConfig(hydratedConfig)
      setInitialServices(hydratedConfig.services)
      setConfigSnapshot(serializeBranchConfig(hydratedConfig))
      setDepositAmountInput(String(hydratedConfig.profile.depositAmount ?? 0))
      resetServiceForm()
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando configuración')
    }
  }

  async function createBranch() {
    if (!tenantId || !session?.user?.id || newBranchName.trim().length < 2) return

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/reservas/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          name: newBranchName,
          slug: newBranchSlug || undefined,
          timeZone: 'America/Argentina/Buenos_Aires',
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 402 || payload?.code === 'BRANCH_LIMIT_REQUIRES_PAYMENT') {
          setMessage(null)
          setError('Necesitás ampliar tu plan para agregar otra sucursal.')
          window.location.href = `/pago?mode=ADD_BRANCH&tenantId=${encodeURIComponent(tenantId)}&slots=1`
          return
        }
        throw new Error(payload?.message ?? 'No se pudo crear la sucursal')
      }

      setMessage('Sucursal creada')
      setNewBranchName('')
      setNewBranchSlug('')
      const branch = payload.branch as BranchSummary
      setBranches((prev) => [...prev, branch])
      setBranchId(branch.id)
      await loadConfig(tenantId, branch.id)
    } catch (err: any) {
      setError(err?.message ?? 'Error creando sucursal')
    } finally {
      setSaving(false)
    }
  }

  async function saveBusinessConfig() {
    if (!tenantId || !branchId || !config || !session?.user?.id) return
    if (!config.branch.name.trim()) {
      setError('El nombre del negocio/sucursal no puede estar vacío para guardar.')
      return false
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
          profile: {
            ...config.profile,
            depositAmount: Math.max(0, Number(depositAmountInput || 0)),
          },
          schedules: config.schedules,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo guardar configuración')

      await syncServices(tenantId, branchId, initialServices, config.services)
      await loadConfig(tenantId, branchId)
      setMessage('Información del negocio guardada')
      return true
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando información')
      return false
    } finally {
      setSaving(false)
    }
  }

  function resetServiceForm() {
    setEditingServiceId(null)
    setServiceForm({
      name: '',
      durationMins: '30',
      priceArs: '0',
      categoryName: '',
      description: '',
      imageUrl: '',
      requiresDeposit: false,
      isActive: true,
    })
  }

  function editService(serviceId: string) {
    if (!config) return
    const service = config.services.find((row) => row.id === serviceId)
    if (!service) return
    setEditingServiceId(service.id)
    setServiceForm({
      name: service.name,
      durationMins: String(service.durationMins),
      priceArs: String(Math.round(Number(service.priceCents || 0) / 100)),
      categoryName: service.categoryName ?? '',
      description: service.description ?? '',
      imageUrl: service.imageUrl ?? '',
      requiresDeposit: Boolean(service.requiresDeposit),
      isActive: service.isActive !== false,
    })
  }

  function normalizeServiceNumbers() {
    return {
      durationMins: Math.max(5, Number(serviceForm.durationMins || 30)),
      priceArs: Math.max(0, Number(serviceForm.priceArs || 0)),
    }
  }

  function applyServiceNumberNormalization() {
    const normalized = normalizeServiceNumbers()
    setServiceForm((prev) => ({
      ...prev,
      durationMins: String(normalized.durationMins),
      priceArs: String(normalized.priceArs),
    }))
  }

  function submitService() {
    if (!config || !serviceForm.name.trim()) return
    setError(null)
    setMessage(null)

    const normalized = normalizeServiceNumbers()
    const nextService = {
      id: editingServiceId || `tmp_${Math.random().toString(36).slice(2, 10)}`,
      name: serviceForm.name.trim(),
      durationMins: normalized.durationMins,
      priceCents: Math.max(0, normalized.priceArs * 100),
      isActive: serviceForm.isActive,
      categoryName: serviceForm.categoryName.trim() || null,
      description: serviceForm.description.trim() || null,
      imageUrl: serviceForm.imageUrl.trim() || null,
      requiresDeposit: serviceForm.requiresDeposit,
    }

    setConfig({
      ...config,
      services: editingServiceId
        ? config.services.map((service) => (service.id === editingServiceId ? nextService : service))
        : [...config.services, nextService],
    })
    setMessage(editingServiceId ? 'Servicio actualizado (borrador)' : 'Servicio agregado (borrador)')
    resetServiceForm()
  }

  function deleteService(serviceId: string) {
    if (!config) return
    setError(null)
    setMessage(null)
    setConfig({ ...config, services: config.services.filter((service) => service.id !== serviceId) })
    setMessage('Servicio eliminado (borrador)')
    if (editingServiceId === serviceId) resetServiceForm()
  }

  async function uploadServiceImage(file: File | null) {
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setServiceForm((prev) => ({ ...prev, imageUrl: dataUrl }))
  }

  function addScheduleRow() {
    if (!config) return
    setConfig({
      ...config,
      schedules: [...config.schedules, { dayOfWeek: 1, startTimeMin: 9 * 60, endTimeMin: 19 * 60 }],
    })
  }

  function upsertScheduleRow(index: number, patch: Partial<ScheduleRow>) {
    if (!config) return
    setConfig({
      ...config,
      schedules: config.schedules.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    })
  }

  function removeScheduleRow(index: number) {
    if (!config) return
    setConfig({
      ...config,
      schedules: config.schedules.filter((_, rowIndex) => rowIndex !== index),
    })
  }

  function confirmLeaveWithoutSaving(nextAction: () => void) {
    if (!hasUnsavedChanges || !config) {
      nextAction()
      return
    }
    setPendingLeaveHref(null)
    setPendingLeaveAction(() => nextAction)
    setLeaveDialogOpen(true)
  }

  function runPendingLeaveAction() {
    const action = pendingLeaveAction
    const href = pendingLeaveHref
    setLeaveDialogOpen(false)
    setPendingLeaveAction(null)
    setPendingLeaveHref(null)
    if (action) {
      action()
      return
    }
    if (href) {
      router.push(href)
    }
  }

  async function handleSaveAndLeave() {
    const saved = await saveBusinessConfig()
    if (!saved) return
    runPendingLeaveAction()
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando información del negocio...</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">{activeTenantName} · Información del negocio</h1>
        <p className="text-muted-foreground">
          Datos operativos por sucursal para la gestión diaria. La parte visual se configura en "Página web de reservas".
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-xl rounded-xl p-5 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Tenés cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              Si salís ahora, vas a perder los datos cargados en esta sucursal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 !flex !flex-col gap-2 sm:!flex-col sm:!space-x-0">
            <AlertDialogAction
              onClick={() => void handleSaveAndLeave()}
              disabled={saving}
              className="w-full justify-center"
            >
              {saving ? 'Guardando...' : 'Guardar datos'}
            </AlertDialogAction>
            <AlertDialogCancel className="mt-0 w-full whitespace-normal h-auto py-2 justify-center">
              Quedarte en esta pestaña y seguir editando
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="w-full justify-center"
              onClick={runPendingLeaveAction}
            >
              Perder los datos y salir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Sucursales</CardTitle>
          <CardDescription>Elegí una pestaña de sucursal para editar su configuración.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 border-b pb-3">
            {branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                className={`rounded-t-md border px-3 py-2 text-sm ${
                  branch.id === branchId ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted/50'
                }`}
                onClick={() =>
                  confirmLeaveWithoutSaving(() => {
                    setBranchId(branch.id)
                    setError(null)
                    setMessage(null)
                  })
                }
              >
                {branch.name}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div className="space-y-2">
              <Label>Nueva sucursal</Label>
              <Input placeholder="Nombre de sucursal" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slug (opcional)</Label>
              <Input placeholder="sucursal-centro" value={newBranchSlug} onChange={(e) => setNewBranchSlug(e.target.value)} />
            </div>
            <Button
              onClick={createBranch}
              disabled={saving || !newBranchName.trim()}
              data-guide-create-branch="1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar sucursal
            </Button>
          </div>
        </CardContent>
      </Card>

      {config ? (
        <Card>
          <CardHeader>
            <CardTitle>{config.branch.name}</CardTitle>
            <CardDescription>Datos operativos de la sucursal actual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4" data-guide-branch-contact="1">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={config.branch.name} onChange={(e) => setConfig({ ...config, branch: { ...config.branch, name: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>Zona horaria</Label>
                <Input
                  value={config.branch.timeZone}
                  onChange={(e) => setConfig({ ...config, branch: { ...config.branch, timeZone: e.target.value } })}
                  placeholder="America/Argentina/Buenos_Aires"
                />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  value={config.profile.address ?? ''}
                  onChange={(e) => setConfig({ ...config, profile: { ...config.profile, address: e.target.value } })}
                  placeholder="Calle, número, ciudad"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={config.profile.phone ?? ''}
                  onChange={(e) => setConfig({ ...config, profile: { ...config.profile, phone: e.target.value } })}
                  placeholder="+54911..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Políticas (texto)</Label>
              <Textarea
                value={config.profile.policyText ?? ''}
                onChange={(e) => setConfig({ ...config, profile: { ...config.profile, policyText: e.target.value } })}
                placeholder="Políticas de la sucursal"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.profile.cancellationEnabled}
                  onChange={(e) => setConfig({ ...config, profile: { ...config.profile, cancellationEnabled: e.target.checked } })}
                />
                Acepta cancelación
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.branch.allowChooseEmployee}
                  onChange={(e) => setConfig({ ...config, branch: { ...config.branch, allowChooseEmployee: e.target.checked } })}
                />
                Permitir elegir trabajador
              </label>
              <div className="space-y-2">
                <Label>Estrategia de asignación</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={config.branch.assignmentStrategy}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      branch: { ...config.branch, assignmentStrategy: e.target.value as AssignmentStrategy },
                    })
                  }
                >
                  <option value="ROTATIVE">Rotativo</option>
                  <option value="BEST_RATED">Por calificación</option>
                  <option value="LOAD_BALANCE">Balancear carga</option>
                  <option value="FIRST_AVAILABLE">Primero disponible</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de seña</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={config.profile.depositType}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      profile: { ...config.profile, depositType: e.target.value as 'NONE' | 'PERCENTAGE' | 'FIXED' },
                    })
                  }
                >
                  <option value="NONE">Sin seña</option>
                  <option value="PERCENTAGE">Porcentaje</option>
                  <option value="FIXED">Monto fijo</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Monto de seña</Label>
                <Input type="number" value={depositAmountInput} onChange={(e) => setDepositAmountInput(e.target.value)} />
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3" data-guide-branch-schedules="1">
              <button type="button" className="w-full flex items-center justify-between text-left" onClick={() => setShowSchedules((prev) => !prev)}>
                <span className="font-medium text-sm">Horarios de la sucursal</span>
                {showSchedules ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {showSchedules ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-end">
                    <Button variant="outline" size="sm" onClick={addScheduleRow}>
                      + Agregar bloque
                    </Button>
                  </div>

                  {config.schedules.length === 0 ? <p className="text-xs text-muted-foreground">Sin horarios configurados.</p> : null}

                  {config.schedules.map((row, index) => {
                    const startHour = Math.floor(row.startTimeMin / 60)
                    const startMinute = row.startTimeMin % 60
                    const endHour = Math.floor(row.endTimeMin / 60)
                    const endMinute = row.endTimeMin % 60
                    const startMinuteOptions = startHour === 24 ? [0] : MINUTE_OPTIONS
                    const endMinuteOptions = endHour === 24 ? [0] : MINUTE_OPTIONS
                    return (
                      <div key={`branch-schedule-${index}`} className="rounded-md border p-2 sm:border-0 sm:p-0">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-end">
                          <div className="space-y-1">
                            <Label className="text-xs">Día</Label>
                            <select
                              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                              value={String(row.dayOfWeek)}
                              onChange={(event) => upsertScheduleRow(index, { dayOfWeek: Number(event.target.value) })}
                            >
                              {DAYS.map((label, dayIndex) => (
                                <option key={`schedule-day-${index}-${dayIndex}`} value={String(dayIndex)}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Desde</Label>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                value={startHour}
                                onChange={(event) => {
                                  const nextHour = Number(event.target.value)
                                  const nextMinute = nextHour === 24 ? 0 : startMinute
                                  upsertScheduleRow(index, { startTimeMin: toMinutes(nextHour, nextMinute) })
                                }}
                              >
                                {HOUR_OPTIONS.map((hour) => (
                                  <option key={`schedule-start-hour-${index}-${hour}`} value={hour}>
                                    {String(hour).padStart(2, '0')}
                                  </option>
                                ))}
                              </select>
                              <span className="text-muted-foreground text-sm">:</span>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                value={startMinute}
                                onChange={(event) =>
                                  upsertScheduleRow(index, { startTimeMin: toMinutes(startHour, Number(event.target.value)) })
                                }
                              >
                                {startMinuteOptions.map((minute) => (
                                  <option key={`schedule-start-minute-${index}-${minute}`} value={minute}>
                                    {String(minute).padStart(2, '0')}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Hasta</Label>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                value={endHour}
                                onChange={(event) => {
                                  const nextHour = Number(event.target.value)
                                  const nextMinute = nextHour === 24 ? 0 : endMinute
                                  upsertScheduleRow(index, { endTimeMin: toMinutes(nextHour, nextMinute) })
                                }}
                              >
                                {HOUR_OPTIONS.map((hour) => (
                                  <option key={`schedule-end-hour-${index}-${hour}`} value={hour}>
                                    {String(hour).padStart(2, '0')}
                                  </option>
                                ))}
                              </select>
                              <span className="text-muted-foreground text-sm">:</span>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                value={endMinute}
                                onChange={(event) =>
                                  upsertScheduleRow(index, { endTimeMin: toMinutes(endHour, Number(event.target.value)) })
                                }
                              >
                                {endMinuteOptions.map((minute) => (
                                  <option key={`schedule-end-minute-${index}-${minute}`} value={minute}>
                                    {String(minute).padStart(2, '0')}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <Button variant="ghost" size="sm" className="justify-start sm:justify-center" onClick={() => removeScheduleRow(index)}>
                            Quitar
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {config ? (
        <Card>
          <CardHeader>
            <CardTitle>Servicios de la sucursal</CardTitle>
            <CardDescription>
              Configurá servicios disponibles. La asignación por trabajador se gestiona en Centro de cuentas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border p-4 space-y-3">
              <button type="button" className="w-full flex items-center justify-between text-left" onClick={() => setShowServices((prev) => !prev)}>
                <span className="font-medium text-sm">Servicios</span>
                {showServices ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {showServices ? (
                <>
                  <p className="text-sm font-medium">{editingServiceId ? 'Editar servicio' : 'Agregar servicio'}</p>
                  <div className="grid md:grid-cols-2 gap-3" data-guide-service-form="1">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <Input
                        placeholder="Cortes, Coloración, Tratamientos..."
                        value={serviceForm.categoryName}
                        onChange={(e) => setServiceForm({ ...serviceForm, categoryName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duración (minutos)</Label>
                      <Input
                        type="number"
                        min={5}
                        step={5}
                        value={serviceForm.durationMins}
                        onChange={(e) => setServiceForm({ ...serviceForm, durationMins: e.target.value })}
                        onBlur={applyServiceNumberNormalization}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Precio (ARS)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={serviceForm.priceArs}
                        onChange={(e) => setServiceForm({ ...serviceForm, priceArs: e.target.value })}
                        onBlur={applyServiceNumberNormalization}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descripción (opcional)</Label>
                    <Textarea rows={2} value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Foto del servicio (opcional)</Label>
                      <div className="flex gap-2 items-center">
                        <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/60">
                          <Upload className="h-4 w-4" />
                          Subir imagen
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadServiceImage(e.target.files?.[0] ?? null)} />
                        </label>
                        <Input
                          placeholder="o URL de imagen"
                          value={serviceForm.imageUrl}
                          onChange={(e) => setServiceForm({ ...serviceForm, imageUrl: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Opciones</Label>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={serviceForm.requiresDeposit}
                            onChange={(e) => setServiceForm({ ...serviceForm, requiresDeposit: e.target.checked })}
                          />
                          Requiere seña
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={serviceForm.isActive}
                            onChange={(e) => setServiceForm({ ...serviceForm, isActive: e.target.checked })}
                          />
                          Activo
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={submitService} disabled={saving || !serviceForm.name.trim()} data-guide-service-add="1">
                      {editingServiceId ? 'Guardar cambios en borrador' : 'Agregar servicio al borrador'}
                    </Button>
                    {editingServiceId ? (
                      <Button type="button" variant="outline" onClick={resetServiceForm} disabled={saving}>
                        Cancelar edición
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            <div className="space-y-3">
              {config.services.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No hay servicios cargados en esta sucursal.</div>
              ) : (
                config.services.map((service) => (
                  <div key={service.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {service.imageUrl ? (
                        <img src={service.imageUrl} alt={service.name} className="h-14 w-14 rounded-md object-cover border" />
                      ) : (
                        <div className="h-14 w-14 rounded-md border grid place-items-center text-xs text-muted-foreground">Sin foto</div>
                      )}
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {service.categoryName ?? 'Sin categoría'} · {service.durationMins} min · ${Math.round(service.priceCents / 100).toLocaleString('es-AR')}
                        </p>
                        {service.description ? <p className="text-sm text-muted-foreground mt-1">{service.description}</p> : null}
                        <p className="text-xs mt-1">{service.requiresDeposit ? 'Requiere seña' : 'Sin seña'} · {service.isActive ? 'Activo' : 'Inactivo'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => editService(service.id)} title="Editar servicio">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteService(service.id)} title="Eliminar servicio">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {config ? (
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {hasUnsavedChanges ? 'Tenés cambios sin guardar en esta sucursal.' : 'No hay cambios pendientes.'}
            </p>
            <Button onClick={saveBusinessConfig} disabled={saving || !hasUnsavedChanges}>
              {saving ? 'Guardando...' : 'Guardar toda la información de la sucursal'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function toMinutes(hour: number, minute: number): number {
  const safeHour = Math.max(0, Math.min(24, Number(hour || 0)))
  const safeMinute = safeHour === 24 ? 0 : Math.max(0, Math.min(59, Number(minute || 0)))
  return safeHour * 60 + safeMinute
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

function serializeBranchConfig(config: BranchConfig) {
  return JSON.stringify({
    branch: {
      name: config.branch.name,
      slug: config.branch.slug,
      timeZone: config.branch.timeZone,
      allowChooseEmployee: config.branch.allowChooseEmployee,
      assignmentStrategy: config.branch.assignmentStrategy,
    },
    profile: {
      ...config.profile,
      carouselPhotoUrls: [...config.profile.carouselPhotoUrls].sort(),
    },
    schedules: [...config.schedules].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    services: [...config.services]
      .map((service) => ({ ...service, priceCents: Number(service.priceCents || 0) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  })
}

function serviceComparable(service: BranchConfig['services'][number]) {
  return {
    name: service.name,
    durationMins: Number(service.durationMins || 0),
    priceCents: Number(service.priceCents || 0),
    isActive: Boolean(service.isActive),
    categoryName: service.categoryName ?? null,
    description: service.description ?? null,
    imageUrl: service.imageUrl ?? null,
    requiresDeposit: Boolean(service.requiresDeposit),
  }
}

async function syncServices(
  tenantId: string,
  branchId: string,
  initialServices: BranchConfig['services'],
  currentServices: BranchConfig['services'],
): Promise<boolean> {
  const session = getStoredAuthSession()
  const userId = session?.user?.id
  if (!userId) return false

  const initialById = new Map(initialServices.map((service) => [service.id, service]))
  const currentExisting = currentServices.filter((service) => !service.id.startsWith('tmp_'))
  const currentById = new Map(currentExisting.map((service) => [service.id, service]))
  const toCreate = currentServices.filter((service) => service.id.startsWith('tmp_'))
  const toDelete = initialServices.filter((service) => !currentById.has(service.id))
  const toUpdate = currentExisting.filter((service) => {
    const before = initialById.get(service.id)
    if (!before) return false
    return JSON.stringify(serviceComparable(before)) !== JSON.stringify(serviceComparable(service))
  })
  const hasChanges = toCreate.length > 0 || toUpdate.length > 0 || toDelete.length > 0

  for (const service of toCreate) {
    const response = await fetch(`/api/reservas/branches/${branchId}/service`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        tenantId,
        name: service.name.trim(),
        durationMins: Math.max(5, Number(service.durationMins || 30)),
        priceCents: Math.max(0, Number(service.priceCents || 0)),
        categoryName: service.categoryName?.trim() || null,
        description: service.description?.trim() || null,
        imageUrl: service.imageUrl?.trim() || null,
        requiresDeposit: Boolean(service.requiresDeposit),
        isActive: service.isActive !== false,
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.message ?? 'No se pudo crear un servicio')
    }
  }

  for (const service of toUpdate) {
    const response = await fetch(`/api/reservas/branches/${branchId}/service/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        tenantId,
        name: service.name.trim(),
        durationMins: Math.max(5, Number(service.durationMins || 30)),
        priceCents: Math.max(0, Number(service.priceCents || 0)),
        categoryName: service.categoryName?.trim() || null,
        description: service.description?.trim() || null,
        imageUrl: service.imageUrl?.trim() || null,
        requiresDeposit: Boolean(service.requiresDeposit),
        isActive: service.isActive !== false,
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.message ?? 'No se pudo actualizar un servicio')
    }
  }

  for (const service of toDelete) {
    const response = await fetch(
      `/api/reservas/branches/${branchId}/service/${service.id}?userId=${encodeURIComponent(userId)}&tenantId=${encodeURIComponent(tenantId)}`,
      { method: 'DELETE' },
    )
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.message ?? 'No se pudo eliminar un servicio')
    }
  }

  return hasChanges
}
