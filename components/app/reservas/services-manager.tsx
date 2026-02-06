'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Trash2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

interface Service {
  id: string
  name: string
  duration: number
  price: number
  category: string
  description?: string
  requiresDeposit: boolean
}

interface ServicesManagerProps {
  branchId: string
}

const initialServices: Service[] = [
  {
    id: '1',
    name: 'Corte clásico',
    duration: 30,
    price: 5000,
    category: 'Cortes',
    requiresDeposit: false,
  },
  {
    id: '2',
    name: 'Corte + Barba',
    duration: 45,
    price: 7000,
    category: 'Cortes',
    requiresDeposit: true,
  },
  {
    id: '3',
    name: 'Barba completa',
    duration: 25,
    price: 3500,
    category: 'Barbas',
    requiresDeposit: false,
  },
]

export function ServicesManager({ branchId }: ServicesManagerProps) {
  const [services, setServices] = useState<Service[]>(initialServices)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const [formData, setFormData] = useState<Partial<Service>>({
    name: '',
    duration: 30,
    price: 0,
    category: 'Cortes',
    description: '',
    requiresDeposit: false,
  })

  const handleAdd = () => {
    setEditingService(null)
    setFormData({
      name: '',
      duration: 30,
      price: 0,
      category: 'Cortes',
      description: '',
      requiresDeposit: false,
    })
    setShowDialog(true)
  }

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setFormData(service)
    setShowDialog(true)
  }

  const handleSave = () => {
    if (editingService) {
      setServices(services.map((s) => (s.id === editingService.id ? { ...s, ...formData } : s)))
    } else {
      setServices([...services, { ...formData, id: Date.now().toString() } as Service])
    }
    setShowDialog(false)
  }

  const handleDelete = (id: string) => {
    setServices(services.filter((s) => s.id !== id))
  }

  const categories = ['Cortes', 'Barbas', 'Coloración', 'Tratamientos', 'Otros']

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Servicios disponibles</h3>
          <p className="text-sm text-muted-foreground">
            Gestioná los servicios que ofrecés en esta sucursal
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar servicio
        </Button>
      </div>

      {/* Services List */}
      <div className="grid gap-4">
        {services.map((service) => (
          <Card key={service.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{service.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {service.category}
                    </Badge>
                    {service.requiresDeposit && (
                      <Badge variant="secondary" className="text-xs">
                        Requiere seña
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{service.duration} min</span>
                    <span className="font-medium text-foreground">
                      ${service.price.toLocaleString()}
                    </span>
                  </div>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mt-2">{service.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(service)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(service.id)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar servicio' : 'Agregar nuevo servicio'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">
                Nombre del servicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Corte clásico"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">
                  Duración (minutos) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  min="5"
                  step="5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">
                  Precio (ARS) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                  min="0"
                  step="100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">
                Categoría <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción breve del servicio"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Foto del servicio (opcional)</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Clic para subir una foto</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label>Requiere seña</Label>
                <p className="text-sm text-muted-foreground">
                  Solicitar pago anticipado para este servicio
                </p>
              </div>
              <Switch
                checked={formData.requiresDeposit}
                onCheckedChange={(checked) => setFormData({ ...formData, requiresDeposit: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.duration || !formData.price}>
              {editingService ? 'Guardar cambios' : 'Agregar servicio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
