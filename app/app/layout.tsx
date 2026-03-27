'use client'

import React from "react"
import { usePathname, useRouter } from 'next/navigation'

import { AppSidebar } from '@/components/app/app-sidebar'
import { AppMobileNav } from '@/components/app/app-mobile-nav'
import { TutorialFab } from '@/components/app/tutorial-fab'
import { TutorialCoachmarks } from '@/components/app/tutorial-coachmarks'
import { useBranchContext } from '@/hooks/use-branch-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { canAccessBranchRoute } from '@/lib/branch-route-access'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    loading,
    hasMultipleBranches,
    activeBranchId,
    branches,
    tenant,
    setActiveBranchId,
    membershipRole,
    activeBranchPermissions,
  } = useBranchContext()

  React.useEffect(() => {
    if (loading) return
    if (branches.length === 1 && !activeBranchId) {
      void setActiveBranchId(branches[0].id)
    }
  }, [loading, branches, activeBranchId, setActiveBranchId])

  const requiresSelection = !loading && hasMultipleBranches && !activeBranchId
  const waitingAutoSelect = !loading && branches.length === 1 && !activeBranchId

  React.useEffect(() => {
    if (loading || requiresSelection || waitingAutoSelect) return
    if (canAccessBranchRoute(pathname, membershipRole, activeBranchPermissions)) return
    router.replace('/app/inicio')
  }, [activeBranchPermissions, loading, membershipRole, pathname, requiresSelection, router, waitingAutoSelect])

  return (
    <div className="min-h-screen bg-muted/30">
      {requiresSelection ? (
        <div className="fixed inset-0 z-[120] bg-background/95 p-4 md:p-8">
          <div className="mx-auto max-w-xl">
            <Card>
              <CardHeader>
                <CardTitle>Elegí la sucursal a la que querés entrar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {tenant?.tenantName ?? 'Negocio'} tiene varias sucursales. Seleccioná una para entrar.
                </p>
                {branches.map((branch) => (
                  <Button
                    key={branch.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => void setActiveBranchId(branch.id)}
                  >
                    {branch.name}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        <main className="min-h-screen pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden">
        <AppMobileNav />
      </div>

      <TutorialFab />
      <TutorialCoachmarks />
    </div>
  )
}
