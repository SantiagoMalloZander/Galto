'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { useAuthSession } from '@/hooks/use-auth-session'

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
  steps: Record<OnboardingStepId, boolean>
}

type TutorialUiStep = {
  id:
    | 'owner-branch-setup'
    | 'owner-services'
    | 'owner-invite-worker'
    | 'owner-assign-worker-services'
    | 'owner-customers'
    | 'owner-booking-config'
    | 'workerProfile'
    | 'workerSchedules'
    | 'workerServices'
    | 'workerCalendar'
    | 'workerTestCustomer'
    | 'workerTurns'
  completionKeys: OnboardingStepId[]
}

export function TutorialFab() {
  const router = useRouter()
  const { session } = useAuthSession()
  const [onboarding, setOnboarding] = useState<OnboardingApiResponse | null>(null)

  const fallbackTenantId = session?.memberships?.[0]?.tenantId ?? ''
  const stepOrder: TutorialUiStep[] =
    onboarding?.actor?.role === 'EMPLOYEE'
      ? [
          { id: 'workerProfile', completionKeys: ['workerProfile'] },
          { id: 'workerSchedules', completionKeys: ['workerSchedules'] },
          { id: 'workerServices', completionKeys: ['workerServices'] },
          { id: 'workerCalendar', completionKeys: ['workerCalendar'] },
          { id: 'workerTestCustomer', completionKeys: ['workerTestCustomer'] },
          { id: 'workerTurns', completionKeys: ['workerTurns'] },
        ]
      : [
          { id: 'owner-branch-setup', completionKeys: ['createBranch', 'configureBranchData'] },
          { id: 'owner-services', completionKeys: ['createService'] },
          { id: 'owner-invite-worker', completionKeys: ['addWorker'] },
          { id: 'owner-assign-worker-services', completionKeys: ['assignWorkerServices'] },
          { id: 'owner-customers', completionKeys: ['addAndDeleteCustomer'] },
          { id: 'owner-booking-config', completionKeys: ['configureBooking', 'createBooking'] },
        ]

  const loadOnboarding = useCallback(async () => {
    if (!session?.user?.id || !fallbackTenantId) {
      setOnboarding(null)
      return
    }

    try {
      const params = new URLSearchParams({
        userId: session.user.id,
        tenantId: fallbackTenantId,
      })
      const response = await fetch(`/api/onboarding/progress?${params.toString()}`, { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as OnboardingApiResponse | null
      if (!response.ok || !payload) return
      setOnboarding(payload)
    } catch {
      // keep previous state if request fails
    }
  }, [fallbackTenantId, session?.user?.id])

  useEffect(() => {
    void loadOnboarding()
    const intervalId = window.setInterval(() => {
      void loadOnboarding()
    }, 5000)
    window.addEventListener('focus', loadOnboarding)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', loadOnboarding)
    }
  }, [loadOnboarding])

  useEffect(() => {
    const syncFromEvent = () => {
      void loadOnboarding()
    }

    window.addEventListener('galto-onboarding-updated', syncFromEvent as EventListener)
    return () => {
      window.removeEventListener('galto-onboarding-updated', syncFromEvent as EventListener)
    }
  }, [loadOnboarding])

  const completedCount = useMemo(() => {
    return stepOrder.filter((step) => step.completionKeys.every((key) => onboarding?.steps?.[key])).length
  }, [onboarding, stepOrder])

  const nextPendingStep = useMemo(
    () => stepOrder.find((step) => !step.completionKeys.every((key) => onboarding?.steps?.[key])) ?? null,
    [onboarding, stepOrder],
  )

  const shouldShow = onboarding ? Boolean(nextPendingStep) : false
  if (!shouldShow) return null

  const handleOpenTutorial = () => {
    const href = nextPendingStep ? `/app/inicio#tutorial-step-${nextPendingStep.id}` : '/app/inicio#tutorial'
    router.push(href)
  }

  return (
    <button
      type="button"
      onClick={handleOpenTutorial}
      className="fixed bottom-20 right-4 z-[130] inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-white shadow-lg transition hover:bg-violet-500 lg:bottom-6"
      aria-label="Abrir tutorial guiado"
      title="Abrir tutorial guiado"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
        G
      </span>
      <span className="text-xs font-semibold leading-tight">
        Tutorial
        <span className="ml-1 font-normal opacity-90">{completedCount}/{stepOrder.length}</span>
      </span>
      <GraduationCap className="h-4 w-4" />
    </button>
  )
}
