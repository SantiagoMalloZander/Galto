'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { ChevronRight, MapPin, Clock, User, Check } from 'lucide-react'

interface BookingPreviewProps {
  branchId: string
}

type Step = 'branch' | 'service' | 'worker' | 'datetime' | 'details' | 'confirmation'

export function BookingPreview({ branchId }: BookingPreviewProps) {
  const [step, setStep] = useState<Step>('branch')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [selectedWorker, setSelectedWorker] = useState('any')
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState('')

  const branches = [
    { id: '1', name: 'Sucursal Centro', address: 'Av. Corrientes 1234' },
    { id: '2', name: 'Sucursal Palermo', address: 'Honduras 5678' },
  ]

  const services = [
    { id: '1', name: 'Corte clásico', duration: 30, price: 5000, category: 'Cortes' },
    { id: '2', name: 'Corte + Barba', duration: 45, price: 7000, category: 'Cortes' },
    { id: '3', name: 'Barba completa', duration: 25, price: 3500, category: 'Barbas' },
  ]

  const workers = [
    { id: '1', name: 'Juan Pérez' },
    { id: '2', name: 'Carlos Gómez' },
  ]

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  ]

  const renderStep = () => {
    switch (step) {
      case 'branch':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Seleccioná una sucursal</h3>
            <RadioGroup value={selectedBranch} onValueChange={setSelectedBranch}>
              {branches.map((branch) => (
                <label
                  key={branch.id}
                  className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem value={branch.id} />
                  <div className="flex-1">
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {branch.address}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>
            <Button
              onClick={() => setStep('service')}
              disabled={!selectedBranch}
              className="w-full"
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )

      case 'service':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Seleccioná un servicio</h3>
            <RadioGroup value={selectedService} onValueChange={setSelectedService}>
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem value={service.id} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{service.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {service.category}
                      </Badge>
                    </div>
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {service.duration} min
                      </span>
                      <span className="font-medium text-foreground">
                        ${service.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('branch')} className="flex-1">
                Atrás
              </Button>
              <Button
                onClick={() => setStep('worker')}
                disabled={!selectedService}
                className="flex-1"
              >
                Continuar
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case 'worker':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">¿Querés elegir un trabajador?</h3>
            <p className="text-sm text-muted-foreground">Opcional - podés dejar que elijamos por vos</p>
            <RadioGroup value={selectedWorker} onValueChange={setSelectedWorker}>
              <label className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent">
                <RadioGroupItem value="any" />
                <div className="flex-1">
                  <p className="font-medium">Cualquier trabajador disponible</p>
                  <p className="text-sm text-muted-foreground">Recomendado</p>
                </div>
              </label>
              {workers.map((worker) => (
                <label
                  key={worker.id}
                  className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem value={worker.id} />
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-medium">{worker.name}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('service')} className="flex-1">
                Atrás
              </Button>
              <Button onClick={() => setStep('datetime')} className="flex-1">
                Continuar
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case 'datetime':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Seleccioná día y hora</h3>
            <div className="border rounded-lg p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date()}
                className="mx-auto"
              />
            </div>
            {selectedDate && (
              <div>
                <Label className="mb-2 block">Horarios disponibles</Label>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('worker')} className="flex-1">
                Atrás
              </Button>
              <Button
                onClick={() => setStep('details')}
                disabled={!selectedDate || !selectedTime}
                className="flex-1"
              >
                Continuar
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case 'details':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Tus datos</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" placeholder="Juan Pérez" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" placeholder="+54 11 1234-5678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea id="notes" placeholder="Algún pedido especial..." rows={3} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('datetime')} className="flex-1">
                Atrás
              </Button>
              <Button onClick={() => setStep('confirmation')} className="flex-1">
                Confirmar reserva
              </Button>
            </div>
          </div>
        )

      case 'confirmation':
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-xl mb-2">¡Reserva confirmada!</h3>
              <p className="text-muted-foreground">
                Te enviamos un mensaje de confirmación por WhatsApp
              </p>
            </div>
            <Card className="text-left">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Servicio:</span>
                  <span className="font-medium">Corte clásico</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="font-medium">Lun 15 Dic, 10:00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sucursal:</span>
                  <span className="font-medium">Centro</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">$5.000</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )
    }
  }

  return (
    <div className="bg-background rounded-lg p-6">
      {renderStep()}
    </div>
  )
}
