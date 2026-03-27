'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, MapPin } from 'lucide-react'

interface BranchSettingsProps {
  branchId: string
}

export function BranchSettings({ branchId }: BranchSettingsProps) {
  const [settings, setSettings] = useState({
    name: 'Sucursal Centro',
    address: 'Av. Corrientes 1234, CABA',
    phone: '+54 11 1234-5678',
    openDays: ['Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    openTime: '09:00',
    closeTime: '19:00',
    cancellationPolicy: true,
    toleranceMinutes: 10,
    requireDeposit: true,
    depositType: 'percentage',
    depositAmount: 20,
    publicNote: 'Recordá llegar 5 minutos antes de tu turno',
  })

  const hourOptions = Array.from({ length: 25 }, (_, hour) => hour)
  const minuteOptions = Array.from({ length: 60 }, (_, minute) => minute)

  const splitTime = (value: string) => {
    const [rawHour, rawMinute] = value.split(':').map(Number)
    return {
      hour: Number.isFinite(rawHour) ? rawHour : 0,
      minute: Number.isFinite(rawMinute) ? rawMinute : 0,
    }
  }

  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  const openTime = splitTime(settings.openTime)
  const closeTime = splitTime(settings.closeTime)
  const openMinuteOptions = openTime.hour === 24 ? [0] : minuteOptions
  const closeMinuteOptions = closeTime.hour === 24 ? [0] : minuteOptions

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información básica</CardTitle>
          <CardDescription>Datos principales de la sucursal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la sucursal</Label>
            <Input
              id="name"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="Calle, número, ciudad"
            />
            <Button variant="outline" size="sm" className="mt-2 bg-transparent">
              <MapPin className="h-4 w-4 mr-2" />
              Ver en mapa
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              placeholder="+54 11 1234-5678"
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Horarios</CardTitle>
          <CardDescription>Configurá los días y horarios de atención</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openTime">Hora de apertura</Label>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={openTime.hour}
                  onChange={(e) => {
                    const nextHour = Number(e.target.value)
                    const nextMinute = nextHour === 24 ? 0 : openTime.minute
                    setSettings({ ...settings, openTime: formatTime(nextHour, nextMinute) })
                  }}
                >
                  {hourOptions.map((hour) => (
                    <option key={`open-hour-${hour}`} value={hour}>
                      {String(hour).padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground text-sm">:</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={openTime.minute}
                  onChange={(e) =>
                    setSettings({ ...settings, openTime: formatTime(openTime.hour, Number(e.target.value)) })
                  }
                >
                  {openMinuteOptions.map((minute) => (
                    <option key={`open-minute-${minute}`} value={minute}>
                      {String(minute).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closeTime">Hora de cierre</Label>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={closeTime.hour}
                  onChange={(e) => {
                    const nextHour = Number(e.target.value)
                    const nextMinute = nextHour === 24 ? 0 : closeTime.minute
                    setSettings({ ...settings, closeTime: formatTime(nextHour, nextMinute) })
                  }}
                >
                  {hourOptions.map((hour) => (
                    <option key={`close-hour-${hour}`} value={hour}>
                      {String(hour).padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground text-sm">:</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={closeTime.minute}
                  onChange={(e) =>
                    setSettings({ ...settings, closeTime: formatTime(closeTime.hour, Number(e.target.value)) })
                  }
                >
                  {closeMinuteOptions.map((minute) => (
                    <option key={`close-minute-${minute}`} value={minute}>
                      {String(minute).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Días disponibles</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.openDays.includes(day)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSettings({ ...settings, openDays: [...settings.openDays, day] })
                      } else {
                        setSettings({ ...settings, openDays: settings.openDays.filter((d) => d !== day) })
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{day}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Políticas</CardTitle>
          <CardDescription>Configurá las reglas para las reservas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Permitir cancelaciones</Label>
              <p className="text-sm text-muted-foreground">
                Los clientes pueden cancelar sus reservas
              </p>
            </div>
            <Switch
              checked={settings.cancellationPolicy}
              onCheckedChange={(checked) => setSettings({ ...settings, cancellationPolicy: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tolerance">Tolerancia de llegada (minutos)</Label>
            <Input
              id="tolerance"
              type="number"
              value={settings.toleranceMinutes}
              onChange={(e) => setSettings({ ...settings, toleranceMinutes: parseInt(e.target.value) })}
            />
            <p className="text-sm text-muted-foreground">
              Tiempo máximo de espera después de la hora programada
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Requiere seña</Label>
                <p className="text-sm text-muted-foreground">
                  Solicitá un pago anticipado para confirmar
                </p>
              </div>
              <Switch
                checked={settings.requireDeposit}
                onCheckedChange={(checked) => setSettings({ ...settings, requireDeposit: checked })}
              />
            </div>

            {settings.requireDeposit && (
              <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
                <div className="space-y-2">
                  <Label>Tipo de seña</Label>
                  <Select
                    value={settings.depositType}
                    onValueChange={(value) => setSettings({ ...settings, depositType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje</SelectItem>
                      <SelectItem value="fixed">Monto fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={settings.depositAmount}
                      onChange={(e) => setSettings({ ...settings, depositAmount: parseInt(e.target.value) })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {settings.depositType === 'percentage' ? '%' : '$'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Public Note */}
      <Card>
        <CardHeader>
          <CardTitle>Nota pública</CardTitle>
          <CardDescription>Mensaje visible para los clientes al reservar</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.publicNote}
            onChange={(e) => setSettings({ ...settings, publicNote: e.target.value })}
            placeholder="Ej: Recordá llegar 5 minutos antes de tu turno"
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle>Fotos</CardTitle>
          <CardDescription>Agregá imágenes de tu sucursal (mínimo 4 fotos)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Subir foto {i}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button size="lg">
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
