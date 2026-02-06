'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Trash2, Upload, Instagram } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Worker {
  id: string
  name: string
  photo?: string
  instagram?: string
  bio?: string
  certifications: string[]
  services: string[]
  schedule: { [key: string]: { start: string; end: string } }
}

interface WorkersManagerProps {
  branchId: string
}

const initialWorkers: Worker[] = [
  {
    id: '1',
    name: 'Juan Pérez',
    instagram: '@juanbarber',
    bio: 'Especialista en cortes clásicos y modernos',
    certifications: ['Barbería profesional', 'Colorimetría'],
    services: ['Corte clásico', 'Corte + Barba'],
    schedule: {
      Lunes: { start: '09:00', end: '18:00' },
      Martes: { start: '09:00', end: '18:00' },
      Miércoles: { start: '09:00', end: '18:00' },
      Jueves: { start: '09:00', end: '18:00' },
      Viernes: { start: '09:00', end: '18:00' },
    },
  },
]

const availableServices = ['Corte clásico', 'Corte + Barba', 'Barba completa', 'Coloración']
const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function WorkersManager({ branchId }: WorkersManagerProps) {
  const [workers, setWorkers] = useState<Worker[]>(initialWorkers)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [customerCanChoose, setCustomerCanChoose] = useState(true)
  const [assignmentStrategy, setAssignmentStrategy] = useState('first-available')

  const [formData, setFormData] = useState<Partial<Worker>>({
    name: '',
    instagram: '',
    bio: '',
    certifications: [],
    services: [],
    schedule: {},
  })

  const handleAdd = () => {
    setEditingWorker(null)
    setFormData({
      name: '',
      instagram: '',
      bio: '',
      certifications: [],
      services: [],
      schedule: {},
    })
    setShowDialog(true)
  }

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker)
    setFormData(worker)
    setShowDialog(true)
  }

  const handleSave = () => {
    if (editingWorker) {
      setWorkers(workers.map((w) => (w.id === editingWorker.id ? { ...w, ...formData } : w)))
    } else {
      setWorkers([...workers, { ...formData, id: Date.now().toString() } as Worker])
    }
    setShowDialog(false)
  }

  const handleDelete = (id: string) => {
    setWorkers(workers.filter((w) => w.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Los clientes pueden elegir trabajador</Label>
              <p className="text-sm text-muted-foreground">
                Si está activado, el cliente puede seleccionar un trabajador específico
              </p>
            </div>
            <Switch
              checked={customerCanChoose}
              onCheckedChange={setCustomerCanChoose}
            />
          </div>

          {customerCanChoose && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label htmlFor="strategy">Estrategia de asignación por defecto</Label>
              <Select value={assignmentStrategy} onValueChange={setAssignmentStrategy}>
                <SelectTrigger id="strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first-available">Primero disponible</SelectItem>
                  <SelectItem value="balance">Balancear carga</SelectItem>
                  <SelectItem value="best-rated">Preferir mejor calificado</SelectItem>
                  <SelectItem value="rotation">Rotativo</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Usada cuando el cliente no elige trabajador específico
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workers List */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Trabajadores</h3>
          <p className="text-sm text-muted-foreground">
            Gestioná tu equipo de trabajo
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar trabajador
        </Button>
      </div>

      <div className="grid gap-4">
        {workers.map((worker) => (
          <Card key={worker.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xl font-semibold text-primary">
                    {worker.name.split(' ').map((n) => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{worker.name}</h4>
                    {worker.instagram && (
                      <a
                        href={`https://instagram.com/${worker.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm flex items-center gap-1"
                      >
                        <Instagram className="h-3 w-3" />
                        {worker.instagram}
                      </a>
                    )}
                  </div>
                  {worker.bio && (
                    <p className="text-sm text-muted-foreground mb-2">{worker.bio}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {worker.services.slice(0, 3).map((service) => (
                      <Badge key={service} variant="secondary" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                    {worker.services.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{worker.services.length - 3} más
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Trabaja: {Object.keys(worker.schedule).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(worker)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(worker.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorker ? 'Editar trabajador' : 'Agregar nuevo trabajador'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium">Información básica</h4>
              
              <div className="space-y-2">
                <Label htmlFor="worker-name">Nombre completo *</Label>
                <Input
                  id="worker-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Juan Pérez"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  placeholder="@usuario"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Mini biografía</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Especialista en cortes clásicos..."
                  rows={2}
                />
              </div>
            </div>

            {/* Services */}
            <div className="space-y-4">
              <h4 className="font-medium">Servicios que realiza *</h4>
              <div className="grid grid-cols-2 gap-2">
                {availableServices.map((service) => (
                  <label key={service} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.services?.includes(service)}
                      onChange={(e) => {
                        const current = formData.services || []
                        if (e.target.checked) {
                          setFormData({ ...formData, services: [...current, service] })
                        } else {
                          setFormData({ ...formData, services: current.filter((s) => s !== service) })
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{service}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              <h4 className="font-medium">Horario semanal</h4>
              <div className="space-y-2">
                {weekDays.map((day) => (
                  <div key={day} className="flex items-center gap-3">
                    <div className="w-28">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.schedule?.[day]}
                          onChange={(e) => {
                            const current = formData.schedule || {}
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                schedule: { ...current, [day]: { start: '09:00', end: '18:00' } },
                              })
                            } else {
                              const { [day]: _, ...rest } = current
                              setFormData({ ...formData, schedule: rest })
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{day}</span>
                      </label>
                    </div>
                    {formData.schedule?.[day] && (
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={formData.schedule[day].start}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              schedule: {
                                ...formData.schedule,
                                [day]: { ...formData.schedule![day], start: e.target.value },
                              },
                            })
                          }
                          className="w-32"
                        />
                        <span className="text-muted-foreground">a</span>
                        <Input
                          type="time"
                          value={formData.schedule[day].end}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              schedule: {
                                ...formData.schedule,
                                [day]: { ...formData.schedule![day], end: e.target.value },
                              },
                            })
                          }
                          className="w-32"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.services?.length}>
              {editingWorker ? 'Guardar cambios' : 'Agregar trabajador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
