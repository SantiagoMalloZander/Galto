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
    openDays: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    openTime: '09:00',
    closeTime: '19:00',
    cancellationPolicy: true,
    toleranceMinutes: 10,
    requireDeposit: true,
    depositType: 'percentage',
    depositAmount: 20,
    publicNote: 'Recordá llegar 5 minutos antes de tu turno',
  })

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
              <Input
                id="openTime"
                type="time"
                value={settings.openTime}
                onChange={(e) => setSettings({ ...settings, openTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closeTime">Hora de cierre</Label>
              <Input
                id="closeTime"
                type="time"
                value={settings.closeTime}
                onChange={(e) => setSettings({ ...settings, closeTime: e.target.value })}
              />
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
