'use client'

import React from 'react'
import { getStoredAuthSession } from '@/lib/auth'

const TUTORIAL_COACHMARKS_KEY = 'galto_tutorial_coachmarks'
const TUTORIAL_COACHMARKS_EVENT = 'galto-tutorial-coachmarks'

type CoachmarkPosition = 'top' | 'bottom'

type Coachmark = {
  selector: string
  text: string
  position?: CoachmarkPosition
}

type StoredCoachmarks = {
  stepId?: string
  expiresAt?: number
  items?: Coachmark[]
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

const STEP_COMPLETION_KEYS: Record<string, OnboardingStepId[]> = {
  'owner-branch-setup': ['createBranch', 'configureBranchData'],
  'owner-services': ['createService'],
  'owner-invite-worker': ['addWorker'],
  'owner-assign-worker-services': ['assignWorkerServices'],
  'owner-customers': ['addAndDeleteCustomer'],
  'owner-booking-config': ['configureBooking', 'createBooking'],
  workerProfile: ['workerProfile'],
  workerSchedules: ['workerSchedules'],
  workerServices: ['workerServices'],
  workerCalendar: ['workerCalendar'],
  workerTestCustomer: ['workerTestCustomer'],
  workerTurns: ['workerTurns'],
}

type CoachmarkPlacement = {
  key: string
  text: string
  index: number
  x: number
  y: number
  position: CoachmarkPosition
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function TutorialCoachmarks() {
  const [items, setItems] = React.useState<Coachmark[]>([])
  const [placements, setPlacements] = React.useState<CoachmarkPlacement[]>([])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const clearCoachmarks = () => {
      window.localStorage.removeItem(TUTORIAL_COACHMARKS_KEY)
      setItems([])
    }

    const shouldClearForCompletedStep = async (parsed: StoredCoachmarks) => {
      const stepId = parsed.stepId ?? ''
      const requiredKeys = STEP_COMPLETION_KEYS[stepId]
      if (!stepId || !requiredKeys?.length) return

      const session = getStoredAuthSession()
      const userId = session?.user?.id
      const tenantId = session?.memberships?.[0]?.tenantId
      if (!userId || !tenantId) return

      try {
        const params = new URLSearchParams({ userId, tenantId })
        const response = await fetch(`/api/onboarding/progress?${params.toString()}`, { cache: 'no-store' })
        const payload = (await response.json().catch(() => null)) as { steps?: Record<string, boolean> } | null
        if (!response.ok || !payload?.steps) return
        const completed = requiredKeys.every((key) => Boolean(payload.steps?.[key]))
        if (completed) {
          clearCoachmarks()
        }
      } catch {
        // keep UI stable if onboarding sync fails
      }
    }

    const sync = () => {
      const raw = window.localStorage.getItem(TUTORIAL_COACHMARKS_KEY)
      if (!raw) {
        setItems([])
        return
      }
      try {
        const parsed = JSON.parse(raw) as StoredCoachmarks
        if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
          clearCoachmarks()
          return
        }
        setItems(Array.isArray(parsed.items) ? parsed.items : [])
        void shouldClearForCompletedStep(parsed)
      } catch {
        setItems([])
      }
    }

    const onCustom = () => sync()
    sync()
    window.addEventListener(TUTORIAL_COACHMARKS_EVENT, onCustom as EventListener)
    window.addEventListener('galto-onboarding-updated', onCustom as EventListener)
    window.addEventListener('storage', sync)
    const intervalId = window.setInterval(sync, 5000)

    return () => {
      window.removeEventListener(TUTORIAL_COACHMARKS_EVENT, onCustom as EventListener)
      window.removeEventListener('galto-onboarding-updated', onCustom as EventListener)
      window.removeEventListener('storage', sync)
      window.clearInterval(intervalId)
    }
  }, [])

  React.useEffect(() => {
    if (items.length === 0 || typeof window === 'undefined') {
      setPlacements([])
      return
    }

    let rafId = 0
    const update = () => {
      const nextPlacements: CoachmarkPlacement[] = []
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const maxBubbleWidth = Math.min(320, viewportWidth - 24)

      items.forEach((item, index) => {
        const element = document.querySelector(item.selector) as HTMLElement | null
        if (!element) return

        const rect = element.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return

        const centerX = rect.left + rect.width / 2
        const desiredX = clamp(centerX, 12 + maxBubbleWidth / 2, viewportWidth - 12 - maxBubbleWidth / 2)
        const isBottom = item.position === 'bottom'
        const desiredY = isBottom ? rect.bottom + 10 : rect.top - 10
        const clampedY = clamp(desiredY, 16, viewportHeight - 16)

        nextPlacements.push({
          key: `${item.selector}-${index}`,
          text: item.text,
          index,
          x: desiredX,
          y: clampedY,
          position: isBottom ? 'bottom' : 'top',
        })
      })

      setPlacements(nextPlacements)
      rafId = window.requestAnimationFrame(update)
    }

    rafId = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(rafId)
  }, [items])

  if (placements.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[135]">
      {placements.map((placement) => (
        <div
          key={placement.key}
          className="absolute max-w-[320px] rounded-lg border border-amber-300 bg-amber-100/95 px-3 py-2 text-[11px] font-medium text-amber-950 shadow-lg"
          style={{
            left: placement.x,
            top: placement.y,
            transform: `translate(-50%, ${placement.position === 'bottom' ? '0' : '-100%'})`,
          }}
        >
          <span className="mr-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
            {placement.index + 1}
          </span>
          {placement.text}
        </div>
      ))}
    </div>
  )
}
