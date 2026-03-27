'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle2, Clock3, Compass, Sparkles, Target } from 'lucide-react'
import { APP_NAV_ITEMS } from '@/lib/app-features'
import { useAuthSession } from '@/hooks/use-auth-session'

type OnboardingApiResponse = {
  tenant: {
    id: string
    slug: string
    name: string
  } | null
  actor: {
    membershipId: string
    role: 'OWNER' | 'MANAGER' | 'EMPLOYEE'
  } | null
  stats: {
    branches: number
    branchDataConfigured: number
    services: number
    workers: number
    workerServiceAssignments: number
    customers: number
    archivedCustomers: number
    bookingConfigured: number
    appointments: number
  }
  steps: {
    createBranch: boolean
    configureBranchData: boolean
    createService: boolean
    addWorker: boolean
    assignWorkerServices: boolean
    addAndDeleteCustomer: boolean
    configureBooking: boolean
    createBooking: boolean
    workerProfile: boolean
    workerSchedules: boolean
    workerServices: boolean
    workerCalendar: boolean
    workerTestCustomer: boolean
    workerTurns: boolean
  }
}

type OnboardingStepId =
  | 'createBranch'
  | 'configureBranchData'
  | 'createService'
  | 'addWorker'
  | 'assignWorkerServices'
  | 'addAndDeleteCustomer'
  | 'configureBooking'
  | 'createBooking'
  | 'workerProfile'
  | 'workerSchedules'
  | 'workerServices'
  | 'workerCalendar'
  | 'workerTestCustomer'
  | 'workerTurns'

type TrailState = {
  startSelector: string
  points: Array<{ selector: string; label: string }>
  targetHref: string
  expiresAt: number
}

type CoachmarkPosition = 'top' | 'bottom'

type Coachmark = {
  selector: string
  text: string
  position?: CoachmarkPosition
}

type OwnerTutorialStepUiId =
  | 'owner-branch-setup'
  | 'owner-services'
  | 'owner-invite-worker'
  | 'owner-assign-worker-services'
  | 'owner-customers'
  | 'owner-booking-config'

type WorkerTutorialStepUiId =
  | 'workerProfile'
  | 'workerSchedules'
  | 'workerServices'
  | 'workerCalendar'
  | 'workerTestCustomer'
  | 'workerTurns'

type TutorialStep = {
  id: OwnerTutorialStepUiId | WorkerTutorialStepUiId
  title: string
  hint: string
  href: string
  targetHref: string
  completionKeys: OnboardingStepId[]
  manualCompleteKeys?: OnboardingStepId[]
  points: Array<{ selector: string; label: string }>
  coachmarks?: Coachmark[]
}

const TUTORIAL_COACHMARKS_KEY = 'galto_tutorial_coachmarks'
const TUTORIAL_COACHMARKS_EVENT = 'galto-tutorial-coachmarks'

function buildGuidePoints(targetHref: string): Array<{ selector: string; label: string }> {
  return [{ selector: `[data-home-module-href="${targetHref}"]`, label: 'Módulo' }]
}

function buildSingleModulePoint(targetHref: string, label = 'Acá'): Array<{ selector: string; label: string }> {
  return [{ selector: `[data-home-module-href="${targetHref}"]`, label }]
}

function notifyCoachmarksUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TUTORIAL_COACHMARKS_EVENT))
}

function clearStoredCoachmarks() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TUTORIAL_COACHMARKS_KEY)
  notifyCoachmarksUpdated()
}

function formatCountdown(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) {
    return '0:00:00:00'
  }

  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function notifyOnboardingUpdated(tenantId?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('galto-onboarding-updated', {
      detail: { tenantId: tenantId ?? null },
    }),
  )
}

function isTutorialStepCompleted(step: TutorialStep, onboarding: OnboardingApiResponse | null) {
  if (!onboarding) return false
  return step.completionKeys.every((key) => Boolean(onboarding.steps[key]))
}

function getInviteWorkerCoachmarks(mode: 'account' | 'external'): Coachmark[] {
  if (mode === 'external') {
    return [
      {
        selector: '[data-home-module-href="/app/cuentas"]',
        text: 'Step 1: Entrá a Centro de cuentas',
      },
      {
        selector: '[data-guide-external-worker-section="1"]',
        text: 'Step 2: Bajá a “Trabajadoras sin cuenta”',
      },
      {
        selector: '[data-guide-external-worker-identity="1"]',
        text: 'Step 3: Completá sucursal y nombre',
      },
      {
        selector: '[data-guide-external-worker-create="1"]',
        text: 'Step 4: Agregá la trabajadora sin cuenta',
      },
    ]
  }

  return [
    {
      selector: '[data-home-module-href="/app/cuentas"]',
      text: 'Step 1: Entrá a Centro de cuentas',
    },
    {
      selector: '[data-guide-worker-type="1"]',
      text: 'Step 2: Elegí tipo de trabajador',
    },
    {
      selector: '[data-guide-worker-template="1"]',
      text: 'Step 3: Aplicá plantilla y revisá permisos',
    },
    {
      selector: '[data-guide-worker-generate-link="1"]',
      text: 'Step 4: Generá el link de trabajador',
    },
  ]
}

export default function InicioPage() {
  const { session, canAccess } = useAuthSession()
  const [countdown, setCountdown] = useState<string | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingApiResponse | null>(null)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [trail, setTrail] = useState<TrailState | null>(null)
  const [highlightHref, setHighlightHref] = useState<string | null>(null)
  const trailTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [inviteModeDialogOpen, setInviteModeDialogOpen] = useState(false)
  const [pendingInviteStep, setPendingInviteStep] = useState<TutorialStep | null>(null)

  const isOwner = useMemo(
    () => Boolean(session?.memberships?.some((membership) => membership.role === 'OWNER')),
    [session?.memberships],
  )

  const modules = useMemo(
    () =>
      APP_NAV_ITEMS.filter(
        (item) =>
          item.href !== '/app/inicio' &&
          (item.href !== '/app/planes' || isOwner) &&
          (!item.feature || canAccess(item.feature)),
      ),
    [canAccess, isOwner],
  )

  const isWorkerTutorial = onboarding?.actor?.role === 'EMPLOYEE'

  const tutorialSteps = useMemo<TutorialStep[]>(() => {
    if (isWorkerTutorial) {
      return [
        {
          id: 'workerProfile',
          title: 'Completá tu perfil personal',
          hint: 'En Centro de cuentas cargá tu Instagram, una breve bio o tu teléfono personal.',
          href: '/app/cuentas',
          targetHref: '/app/cuentas',
          completionKeys: ['workerProfile'],
          points: buildGuidePoints('/app/cuentas'),
          coachmarks: [
            {
              selector: '[data-home-module-href="/app/cuentas"]',
              text: 'Step 1: Entrá a Centro de cuentas',
            },
          ],
        },
        {
          id: 'workerSchedules',
          title: 'Configurá tus horarios',
          hint: 'Definí los horarios en los que trabajás en tu sucursal.',
          href: '/app/cuentas',
          targetHref: '/app/cuentas',
          completionKeys: ['workerSchedules'],
          points: buildGuidePoints('/app/cuentas'),
          coachmarks: [
            {
              selector: '[data-home-module-href="/app/cuentas"]',
              text: 'Step 1: Entrá a Centro de cuentas',
            },
          ],
        },
        {
          id: 'workerServices',
          title: 'Asignate servicios',
          hint: 'Marcá qué servicios realizás para que después puedas aparecer disponible.',
          href: '/app/cuentas',
          targetHref: '/app/cuentas',
          completionKeys: ['workerServices'],
          points: buildGuidePoints('/app/cuentas'),
          coachmarks: [
            {
              selector: '[data-home-module-href="/app/cuentas"]',
              text: 'Step 1: Entrá a Centro de cuentas',
            },
          ],
        },
        {
          id: 'workerCalendar',
          title: 'Revisá tu calendario',
          hint: 'Entrá a Calendario y chequeá cómo vas a ver tus turnos.',
          href: '/app/calendario',
          targetHref: '/app/calendario',
          completionKeys: ['workerCalendar'],
          points: buildGuidePoints('/app/calendario'),
          coachmarks: [
            {
              selector: '[data-home-module-href="/app/calendario"]',
              text: 'Step 1: Entrá a Calendario',
            },
          ],
        },
        {
          id: 'workerTestCustomer',
          title: 'Cargá tu primer cliente de prueba',
          hint: 'Desde Calendario usá “Agregar turno” y registrá un cliente de prueba para practicar el flujo.',
          href: '/app/calendario',
          targetHref: '/app/calendario',
          completionKeys: ['workerTestCustomer'],
          points: buildGuidePoints('/app/calendario'),
          coachmarks: [
            {
              selector: '[data-home-module-href="/app/calendario"]',
              text: 'Step 1: Entrá a Calendario',
            },
          ],
        },
        {
          id: 'workerTurns',
          title: 'Confirmá cómo vas a ver tus turnos',
          hint: 'Marcá este paso cuando ya entiendas cómo leer y usar tu agenda diaria.',
          href: '/app/calendario',
          targetHref: '/app/calendario',
          completionKeys: ['workerTurns'],
          points: buildGuidePoints('/app/calendario'),
          coachmarks: [
            {
              selector: '[data-home-module-href="/app/calendario"]',
              text: 'Step 1: Revisá tu agenda en Calendario',
            },
          ],
        },
      ]
    }

    return [
      {
        id: 'owner-branch-setup',
        title: 'Creá y configurá tu sucursal',
        hint: 'Entrá en Información del negocio, creá la sucursal y dejá listos calle, teléfono y horarios.',
        href: '/app/reservas',
        targetHref: '/app/reservas',
        completionKeys: ['createBranch', 'configureBranchData'],
        manualCompleteKeys: ['createBranch', 'configureBranchData'],
        points: buildSingleModulePoint('/app/reservas', 'Información del negocio'),
        coachmarks: [
          {
            selector: '[data-home-module-href="/app/reservas"]',
            text: 'Step 1: Ir a Información del negocio',
            position: 'top',
          },
          {
            selector: '[data-guide-create-branch="1"]',
            text: 'Step 2: Creá la sucursal',
            position: 'top',
          },
          {
            selector: '[data-guide-branch-contact="1"]',
            text: 'Step 3: Completá calle y teléfono',
            position: 'top',
          },
          {
            selector: '[data-guide-branch-schedules="1"]',
            text: 'Step 4: Configurá horarios',
            position: 'top',
          },
        ],
      },
      {
        id: 'owner-services',
        title: 'Cargá o editá un servicio',
        hint: 'Ya viene un servicio base. Podés crear uno nuevo o editar el existente.',
        href: '/app/reservas',
        targetHref: '/app/reservas',
        completionKeys: ['createService'],
        points: buildSingleModulePoint('/app/reservas', 'Información del negocio'),
        coachmarks: [
          {
            selector: '[data-home-module-href="/app/reservas"]',
            text: 'Step 1: Abrí Información del negocio',
            position: 'bottom',
          },
          {
            selector: '[data-guide-service-form="1"]',
            text: 'Step 2: Cargá un nuevo servicio (además del que ya viene)',
            position: 'top',
          },
          {
            selector: '[data-guide-service-add="1"]',
            text: 'Step 3: Agregalo al borrador y después guardá la sucursal',
            position: 'top',
          },
        ],
      },
      {
        id: 'owner-invite-worker',
        title: 'Invitá a un trabajador',
        hint: 'Generá link desde Centro de cuentas. El trabajador se registra e inicia sesión con su usuario.',
        href: '/app/cuentas',
        targetHref: '/app/cuentas',
        completionKeys: ['addWorker'],
        points: buildGuidePoints('/app/cuentas'),
        coachmarks: getInviteWorkerCoachmarks('account'),
      },
      {
        id: 'owner-assign-worker-services',
        title: 'Asigná servicios al trabajador',
        hint: 'En Centro de cuentas, entrá al trabajador y marcá qué servicios realiza por sucursal.',
        href: '/app/cuentas',
        targetHref: '/app/cuentas',
        completionKeys: ['assignWorkerServices'],
        points: buildGuidePoints('/app/cuentas'),
        coachmarks: [
          {
            selector: '[data-home-module-href="/app/cuentas"]',
            text: 'Step 1: Entrá a Centro de cuentas',
          },
          {
            selector: '[data-guide-worker-item="1"]',
            text: 'Step 2: Seleccioná el trabajador agregado',
          },
          {
            selector: '[data-guide-worker-services="1"]',
            text: 'Step 3: Asigná los servicios que realiza',
          },
        ],
      },
      {
        id: 'owner-customers',
        title: 'Agregá un cliente desde Calendario',
        hint: 'Entrá al calendario, tocá un bloque vacío y cargá un cliente desde ahí.',
        href: '/app/calendario',
        targetHref: '/app/calendario',
        completionKeys: ['addAndDeleteCustomer'],
        points: buildGuidePoints('/app/calendario'),
        coachmarks: [
          {
            selector: '[data-home-module-href="/app/calendario"]',
            text: 'Step 1: Entrá a Calendario',
          },
          {
            selector: '[data-guide-calendar-add-slot="1"]',
            text: 'Step 2: Tocá un bloque vacío para crear turno',
          },
          {
            selector: '[data-guide-calendar-client-name="1"]',
            text: 'Step 3: Completá nombre y datos del cliente',
          },
          {
            selector: '[data-guide-calendar-save="1"]',
            text: 'Step 4: Guardá el cliente en la agenda',
          },
        ],
      },
      {
        id: 'owner-booking-config',
        title: 'Configurá la web de reservas y probá el link',
        hint: 'Subí el logo del negocio y copiá el link de reservas para validar el flujo.',
        href: '/app/pagina-web',
        targetHref: '/app/pagina-web',
        completionKeys: ['configureBooking', 'createBooking'],
        points: buildGuidePoints('/app/pagina-web'),
        coachmarks: [
          {
            selector: '[data-home-module-href="/app/pagina-web"]',
            text: 'Step 1: Entrá a Página web de reservas',
          },
          {
            selector: '[data-guide-booking-tenant-logo="1"]',
            text: 'Step 2: Subí el logo del negocio',
          },
          {
            selector: '[data-guide-booking-copy-link="1"]',
            text: 'Step 3: Copiá el link público para abrir la página',
          },
        ],
      },
    ]
  }, [isWorkerTutorial])

  const completedCount = useMemo(() => {
    if (!onboarding) return 0
    return tutorialSteps.filter((step) => isTutorialStepCompleted(step, onboarding)).length
  }, [onboarding, tutorialSteps])

  const progressValue = Math.round((completedCount / tutorialSteps.length) * 100)
  const isTutorialCompleted = completedCount >= tutorialSteps.length && tutorialSteps.length > 0

  const isDemo = session?.accountAccess.mode === 'DEMO'
  const isPendingPayment = session?.accountAccess.paymentStatus === 'PENDING'
  const demoEndsAt = session?.accountAccess.demoEndsAt
  const activeTenantId = onboarding?.tenant?.id ?? session?.memberships?.[0]?.tenantId ?? ''

  useEffect(() => {
    if (!isDemo || !demoEndsAt) {
      setCountdown(null)
      return
    }

    const update = () => setCountdown(formatCountdown(demoEndsAt))
    update()
    const id = setInterval(update, 1000)

    return () => clearInterval(id)
  }, [isDemo, demoEndsAt])

  useEffect(() => {
    if (!session?.user?.id) return

    let cancelled = false
    const loadOnboarding = async () => {
      setOnboardingLoading(true)
      try {
        const params = new URLSearchParams({
          userId: session.user.id,
        })
        if (session.memberships?.[0]?.tenantId) {
          params.set('tenantId', session.memberships[0].tenantId)
        }

        const response = await fetch(`/api/onboarding/progress?${params.toString()}`, {
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => null)) as OnboardingApiResponse | null
        if (!response.ok || !payload || cancelled) return
        setOnboarding(payload)
      } finally {
        if (!cancelled) setOnboardingLoading(false)
      }
    }

    const syncOnboarding = () => {
      void loadOnboarding()
    }

    void loadOnboarding()
    const id = window.setInterval(syncOnboarding, 5000)
    window.addEventListener('focus', syncOnboarding)
    window.addEventListener('galto-onboarding-updated', syncOnboarding as EventListener)

    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener('focus', syncOnboarding)
      window.removeEventListener('galto-onboarding-updated', syncOnboarding as EventListener)
    }
  }, [session?.user?.id, session?.memberships])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('galto_guide_target')
    }
    return () => {
      if (trailTimeoutRef.current) clearTimeout(trailTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!onboarding) return
    if (isTutorialCompleted) {
      clearStoredCoachmarks()
      return
    }
    const nextPending = tutorialSteps.find((step) => !isTutorialStepCompleted(step, onboarding))
    if (!nextPending) {
      clearStoredCoachmarks()
    }
  }, [isTutorialCompleted, onboarding, tutorialSteps])

  useEffect(() => {
    if (typeof window === 'undefined' || !onboarding) return
    const raw = window.localStorage.getItem(TUTORIAL_COACHMARKS_KEY)
    if (!raw) return
    try {
      const stored = JSON.parse(raw) as { stepId?: string }
      const currentStep = tutorialSteps.find((step) => step.id === stored.stepId)
      if (!currentStep) {
        clearStoredCoachmarks()
        return
      }
      if (isTutorialStepCompleted(currentStep, onboarding)) {
        clearStoredCoachmarks()
      }
    } catch {
      clearStoredCoachmarks()
    }
  }, [onboarding, tutorialSteps])

  async function markManualStep(stepId: OnboardingStepId) {
    if (!activeTenantId || !session?.user?.id) return
    try {
      const response = await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId: activeTenantId,
          stepId,
          completed: true,
        }),
      })
      if (!response.ok) throw new Error('No se pudo guardar el progreso')
      setOnboarding((current) =>
        current
          ? {
              ...current,
              steps: {
                ...current.steps,
                [stepId]: true,
              },
            }
          : current,
      )
      notifyOnboardingUpdated(activeTenantId)
    } catch {
      // keep current UI state if persistence fails
    }
  }

  function startTrail(step: TutorialStep) {
    if (!step.targetHref) return
    const startSelector = `[data-guide-start="${step.id}"]`
    const expiresAt = Date.now() + 6000

    setTrail({
      startSelector,
      points: step.points,
      targetHref: step.targetHref,
      expiresAt,
    })
    setHighlightHref(step.targetHref)

    if (trailTimeoutRef.current) clearTimeout(trailTimeoutRef.current)
    trailTimeoutRef.current = setTimeout(() => {
      setTrail(null)
      setHighlightHref(null)
    }, 6000)
  }

  function setStepCoachmarks(step: TutorialStep) {
    if (typeof window === 'undefined') return
    if (!step.coachmarks || step.coachmarks.length === 0) {
      clearStoredCoachmarks()
      return
    }
    const expiresAt = Date.now() + 1000 * 60 * 20
    window.localStorage.setItem(
      TUTORIAL_COACHMARKS_KEY,
      JSON.stringify({
        stepId: step.id,
        expiresAt,
        items: step.coachmarks,
      }),
    )
    notifyCoachmarksUpdated()
  }

  function startInviteWorkerGuide(mode: 'account' | 'external') {
    if (!pendingInviteStep) return
    const step = pendingInviteStep
    startTrail(step)
    setStepCoachmarks({ ...step, coachmarks: getInviteWorkerCoachmarks(mode) })
    setInviteModeDialogOpen(false)
    setPendingInviteStep(null)
  }

  function guideStep(step: TutorialStep) {
    if (step.id === 'owner-invite-worker') {
      setPendingInviteStep(step)
      setInviteModeDialogOpen(true)
      return
    }
    startTrail(step)
    setStepCoachmarks(step)
  }

  async function skipStep(step: TutorialStep) {
    const keys = step.manualCompleteKeys ?? step.completionKeys
    await Promise.all(keys.map((key) => markManualStep(key)))
    clearStoredCoachmarks()
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {trail ? (
        <div className="pointer-events-none fixed inset-0 z-40">
          <TrailEffect trail={trail} />
        </div>
      ) : null}

      <Dialog
        open={inviteModeDialogOpen}
        onOpenChange={(open) => {
          setInviteModeDialogOpen(open)
          if (!open) setPendingInviteStep(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cómo querés sumar al trabajador?</DialogTitle>
            <DialogDescription>
              Elegí si se une con cuenta propia (link de invitación) o si querés simular una trabajadora interna sin cuenta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => startInviteWorkerGuide('external')}>
              Simular trabajadora sin cuenta
            </Button>
            <Button type="button" onClick={() => startInviteWorkerGuide('account')}>
              Invitar trabajadora con cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
          ¡Bienvenido a GALTO!
        </h1>
        <p className="text-muted-foreground text-lg">Tu centro de gestión para hacer crecer tu barbería</p>
      </div>

      {session?.accountAccess && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">Estado de tu cuenta</CardTitle>
              <Badge variant={session.accountAccess.isPaid ? 'default' : 'secondary'}>
                {session.accountAccess.planName ?? session.accountAccess.mode}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isDemo && countdown && (
              <p className="text-sm flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                Te quedan <strong>{countdown}</strong> del plan gratis.
              </p>
            )}

            {isPendingPayment && isOwner && (
              <p className="text-sm text-amber-700">
                Tu pago está en confirmación manual. Revisalo en <Link href="/app/planes" className="underline">Planes y pagos</Link>.
              </p>
            )}

            {isDemo && !countdown && (
              <p className="text-sm">Plan gratis activo. Tenés agenda online, calendario, clientes y centro de cuentas habilitados.</p>
            )}

            {!isDemo && !isPendingPayment && (
              <p className="text-sm">Plan activo. Apps habilitadas según tu suscripción.</p>
            )}
          </CardContent>
        </Card>
      )}

      {onboarding && !isTutorialCompleted ? (
        <Card id="tutorial" className="mb-8 border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-white">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Compass className="h-5 w-5 text-primary" />
                Mini tutorial guiado
              </CardTitle>
              <CardDescription>
                Seguí los pasos en orden. Cada paso muestra el camino completo con marcadores y opciones de Skipear o Continuar.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              {completedCount}/{tutorialSteps.length} completados
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progreso de configuración</span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} />
          </div>

          {onboardingLoading ? <p className="text-sm text-muted-foreground">Actualizando progreso...</p> : null}

          <div className="space-y-3">
            {tutorialSteps.map((step, index) => {
              const completed = isTutorialStepCompleted(step, onboarding)
              return (
                <div
                  key={step.id}
                  id={`tutorial-step-${step.id}`}
                  className={`rounded-lg border p-3 ${completed ? 'border-emerald-200 bg-emerald-50/60' : 'border-primary/20 bg-white/80'}`}
                  style={{ scrollMarginTop: 96 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">
                          {index + 1}
                        </span>
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{step.hint}</p>
                    </div>
                    {completed ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">OK</Badge>
                    ) : (
                      <Badge variant="secondary">Pendiente</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {!completed ? (
                      <Button size="sm" variant="outline" onClick={() => void skipStep(step)}>
                        Skipear
                      </Button>
                    ) : null}
                    {!completed ? (
                      <Button
                        size="sm"
                        data-guide-start={step.id}
                        onClick={() => guideStep(step)}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Continuar
                      </Button>
                    ) : null}
                    {completed ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={step.href}>Abrir módulo</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
        </Card>
      ) : null}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">Módulos disponibles</h2>
        <p className="text-sm text-muted-foreground">Solo ves los módulos habilitados para tu plan.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((module) => (
          <Link key={module.name} href={module.href} data-module-href={module.href} data-home-module-href={module.href}>
            <Card
              className={`h-full hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary/20 ${
                highlightHref === module.href ? 'ring-2 ring-primary/70 border-primary/40 shadow-xl' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className={`h-12 w-12 rounded-lg ${module.color} flex items-center justify-center mb-3`}>
                  <module.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-base leading-tight">{module.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">{module.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

function TrailEffect({ trail }: { trail: TrailState }) {
  const [points, setPoints] = useState<Array<{ x: number; y: number; label: string }>>([])

  useEffect(() => {
    let raf = 0
    const update = () => {
      const startEl = document.querySelector(trail.startSelector) as HTMLElement | null
      const nextPoints: Array<{ x: number; y: number; label: string }> = []
      if (startEl) {
        const startRect = startEl.getBoundingClientRect()
        nextPoints.push({
          x: startRect.left + startRect.width / 2,
          y: startRect.top + startRect.height / 2,
          label: 'Inicio',
        })
      }

      for (const point of trail.points) {
        const pointEl = document.querySelector(point.selector) as HTMLElement | null
        if (!pointEl) continue
        const pointRect = pointEl.getBoundingClientRect()
        nextPoints.push({
          x: pointRect.left + pointRect.width / 2,
          y: pointRect.top + pointRect.height / 2,
          label: point.label,
        })
      }

      setPoints(nextPoints)
      if (Date.now() < trail.expiresAt) {
        raf = window.requestAnimationFrame(update)
      }
    }
    raf = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(raf)
  }, [trail])

  if (points.length < 2) return null

  return (
    <>
      {points.slice(0, -1).map((point, index) => {
        const nextPoint = points[index + 1]
        const dx = nextPoint.x - point.x
        const dy = nextPoint.y - point.y
        const length = Math.sqrt(dx * dx + dy * dy)
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI

        return (
          <div
            key={`trail-line-${index}`}
            className="absolute h-1 rounded-full bg-gradient-to-r from-primary/20 via-primary to-primary/20 shadow-[0_0_18px_rgba(30,64,175,0.45)] animate-pulse"
            style={{
              left: point.x,
              top: point.y,
              width: Math.max(16, length),
              transform: `translateY(-50%) rotate(${angle}deg)`,
              transformOrigin: 'left center',
            }}
          />
        )
      })}

      {points.map((point, index) => {
        const isLast = index === points.length - 1
        return (
          <div key={`trail-point-${index}`}>
            <div
              className={`absolute rounded-full ${isLast ? 'h-4 w-4 border-2 border-primary bg-primary/20 animate-ping' : 'h-3 w-3 bg-primary animate-ping'}`}
              style={{
                left: point.x - (isLast ? 8 : 6),
                top: point.y - (isLast ? 8 : 6),
              }}
            />
            <div
              className={`absolute rounded-full ${isLast ? 'h-2 w-2 bg-primary' : 'h-2 w-2 bg-primary/90'}`}
              style={{
                left: point.x - 4,
                top: point.y - 4,
              }}
            />
            <div
              className="absolute text-[10px] font-semibold px-2 py-1 rounded-full bg-primary text-primary-foreground shadow"
              style={{
                left: Math.max(8, point.x + 8),
                top: Math.max(8, point.y - 10),
              }}
            >
              <Target className="h-3 w-3 inline mr-1" />
              {isLast ? 'Acá' : point.label}
            </div>
          </div>
        )
      })}
    </>
  )
}
