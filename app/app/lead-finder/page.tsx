'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Target, Send, Users, Clock } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export default function LeadFinderPage() {
  const [selectedBranch, setSelectedBranch] = useState('1')
  const [selectedDate, setSelectedDate] = useState('')
  const [timeSlots, setTimeSlots] = useState<string[]>([])
  const [hasDiscount, setHasDiscount] = useState(false)
  const [discountType, setDiscountType] = useState('percentage')
  const [discountValue, setDiscountValue] = useState(0)
  const [monthsInactive, setMonthsInactive] = useState(3)
  const [minVisits, setMinVisits] = useState(1)
  const [maxMessages, setMaxMessages] = useState(50)
  const [sendCadence, setSendCadence] = useState('30')
  const [autoMode, setAutoMode] = useState(true)

  const branches = [
    { id: '1', name: 'Sucursal Centro' },
    { id: '2', name: 'Sucursal Palermo' },
  ]

  const availableSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  ]

  const estimatedReach = 245

  const toggleTimeSlot = (slot: string) => {
    if (timeSlots.includes(slot)) {
      setTimeSlots(timeSlots.filter((s) => s !== slot))
    } else {
      setTimeSlots([...timeSlots, slot])
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">Lead Finder</h1>
        <p className="text-muted-foreground">
          Enviá campañas de WhatsApp para llenar huecos en tu agenda
        </p>
      </div>

      <div className="grid gap-6">
        {/* Branch & Date Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Configuración de campaña
            </CardTitle>
            <CardDescription>
              Seleccioná la sucursal, fecha y horarios que querés llenar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch">Sucursal</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger id="branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {selectedDate && (
              <div className="space-y-2">
                <Label>Horarios disponibles</Label>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot}
                      variant={timeSlots.includes(slot) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleTimeSlot(slot)}
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
                {timeSlots.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {timeSlots.length} horario{timeSlots.length !== 1 ? 's' : ''} seleccionado{timeSlots.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discount Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Descuento opcional</CardTitle>
            <CardDescription>
              Ofrecé un descuento especial para estos horarios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Incluir descuento</Label>
              <Switch checked={hasDiscount} onCheckedChange={setHasDiscount} />
            </div>

            {hasDiscount && (
              <div className="space-y-4 pl-4 border-l-2">
                <RadioGroup value={discountType} onValueChange={setDiscountType}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="percentage" />
                    <Label htmlFor="percentage">Porcentaje de descuento</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="fixed" />
                    <Label htmlFor="fixed">Monto fijo de descuento</Label>
                  </div>
                </RadioGroup>

                <div className="space-y-2">
                  <Label htmlFor="discount-value">
                    Valor del descuento ({discountType === 'percentage' ? '%' : 'ARS'})
                  </Label>
                  <Input
                    id="discount-value"
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseInt(e.target.value))}
                    placeholder={discountType === 'percentage' ? '20' : '1000'}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Targeting Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Filtros de audiencia
            </CardTitle>
            <CardDescription>
              Definí a quién enviar la campaña (los filtros son combinables)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="months-inactive">
                No ha visitado en los últimos (meses)
              </Label>
              <Input
                id="months-inactive"
                type="number"
                value={monthsInactive}
                onChange={(e) => setMonthsInactive(parseInt(e.target.value))}
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-visits">
                Ha visitado más de (cantidad de veces)
              </Label>
              <Input
                id="min-visits"
                type="number"
                value={minVisits}
                onChange={(e) => setMinVisits(parseInt(e.target.value))}
                min="1"
              />
            </div>

            <div className="p-4 bg-primary/5 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Audiencia estimada</p>
                  <p className="text-sm text-muted-foreground">
                    Clientes que coinciden con tus filtros
                  </p>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {estimatedReach}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Control de envío
            </CardTitle>
            <CardDescription>
              Configurá cómo y cuándo enviar los mensajes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max-messages">Total de mensajes a enviar</Label>
              <Input
                id="max-messages"
                type="number"
                value={maxMessages}
                onChange={(e) => setMaxMessages(parseInt(e.target.value))}
                min="1"
                max={estimatedReach}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cadence">Cadencia de envío</Label>
              <Select value={sendCadence} onValueChange={setSendCadence}>
                <SelectTrigger id="cadence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Cada 10 minutos</SelectItem>
                  <SelectItem value="30">Cada 30 minutos</SelectItem>
                  <SelectItem value="60">Cada 1 hora</SelectItem>
                  <SelectItem value="120">Cada 2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label>Modo automático</Label>
                <p className="text-sm text-muted-foreground">
                  Detener cuando los horarios se llenen
                </p>
              </div>
              <Switch checked={autoMode} onCheckedChange={setAutoMode} />
            </div>
          </CardContent>
        </Card>

        {/* Launch Campaign */}
        <Card className="border-primary">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">Lista para lanzar</h3>
                <p className="text-sm text-muted-foreground">
                  Se enviarán hasta {maxMessages} mensajes con una cadencia de {sendCadence} minutos
                </p>
              </div>
              <Button size="lg" disabled={!selectedDate || timeSlots.length === 0}>
                <Send className="h-5 w-5 mr-2" />
                Lanzar campaña
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
