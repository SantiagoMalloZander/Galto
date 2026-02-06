'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus, Eye } from 'lucide-react'
import { BranchSettings } from '@/components/app/reservas/branch-settings'
import { ServicesManager } from '@/components/app/reservas/services-manager'
import { WorkersManager } from '@/components/app/reservas/workers-manager'
import { BookingPreview } from '@/components/app/reservas/booking-preview'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AddBranchDialog } from '@/components/app/reservas/add-branch-dialog'

// Sample data
const initialBranches = [
  { id: '1', name: 'Sucursal Centro' },
  { id: '2', name: 'Sucursal Palermo' },
]

export default function ReservasPage() {
  const [selectedBranch, setSelectedBranch] = useState('1')
  const [branches, setBranches] = useState(initialBranches)
  const [showPreview, setShowPreview] = useState(false)
  const [showAddBranch, setShowAddBranch] = useState(false)

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">
          Personalizá tu página de reservas
        </h1>
        <p className="text-muted-foreground">
          Configurá servicios, trabajadores y horarios para cada sucursal
        </p>
      </div>

      {/* Branch Selector + Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Seleccioná una sucursal" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2 sm:ml-auto">
          <Dialog open={showAddBranch} onOpenChange={setShowAddBranch}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nueva sucursal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Agregar nueva sucursal</DialogTitle>
              </DialogHeader>
              <AddBranchDialog
                branches={branches}
                onAdd={(branch) => {
                  setBranches([...branches, branch])
                  setSelectedBranch(branch.id)
                  setShowAddBranch(false)
                }}
                onCancel={() => setShowAddBranch(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogTrigger asChild>
              <Button>
                <Eye className="h-4 w-4 mr-2" />
                Vista previa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Vista previa - Página de reservas</DialogTitle>
              </DialogHeader>
              <BookingPreview branchId={selectedBranch} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Configuration Tabs */}
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="settings">Datos y configuración</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
          <TabsTrigger value="workers">Trabajadores</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <BranchSettings branchId={selectedBranch} />
        </TabsContent>

        <TabsContent value="services">
          <ServicesManager branchId={selectedBranch} />
        </TabsContent>

        <TabsContent value="workers">
          <WorkersManager branchId={selectedBranch} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
