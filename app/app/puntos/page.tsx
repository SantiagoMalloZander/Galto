'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Gift, TrendingUp, Award } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Customer {
  id: string
  name: string
  points: number
  visits: number
  nextReward: string
}

const sampleCustomers: Customer[] = [
  { id: '1', name: 'Juan Pérez', points: 45, visits: 9, nextReward: 'Corte gratis (50 puntos)' },
  { id: '2', name: 'Carlos Gómez', points: 38, visits: 8, nextReward: 'Corte gratis (50 puntos)' },
  { id: '3', name: 'Diego Martínez', points: 52, visits: 10, nextReward: '20% descuento (75 puntos)' },
  { id: '4', name: 'Lucas García', points: 28, visits: 6, nextReward: 'Corte gratis (50 puntos)' },
]

export default function PuntosPage() {
  const [loyaltyMode, setLoyaltyMode] = useState<'visits' | 'points'>('points')
  const [visitsForReward, setVisitsForReward] = useState(10)
  const [pointsPerPeso, setPointsPerPeso] = useState(1)

  const rewards = [
    { id: '1', name: 'Corte gratis', points: 50, type: 'service' },
    { id: '2', name: '20% descuento', points: 75, type: 'discount', duration: '1 mes' },
    { id: '3', name: 'Semana de 4 cortes gratis para invitar', points: 100, type: 'invite' },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">Puntos de clientes</h1>
        <p className="text-muted-foreground">
          Gestioná tu programa de lealtad y recompensas
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="rewards">Recompensas</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          {/* Loyalty Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Modo de programa de lealtad</CardTitle>
              <CardDescription>
                Elegí cómo querés recompensar a tus clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={loyaltyMode} onValueChange={(v) => setLoyaltyMode(v as 'visits' | 'points')}>
                <div className="space-y-4">
                  <label className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="visits" className="mt-1" />
                    <div className="flex-1">
                      <p className="font-medium mb-1">Modo A: Por cantidad de visitas</p>
                      <p className="text-sm text-muted-foreground">
                        Cada X visitas, el cliente recibe un corte gratis o descuento
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="points" className="mt-1" />
                    <div className="flex-1">
                      <p className="font-medium mb-1">Modo B: Por puntos según gasto</p>
                      <p className="text-sm text-muted-foreground">
                        Los clientes acumulan puntos según el monto gastado y canjean recompensas
                      </p>
                    </div>
                  </label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Mode-specific Configuration */}
          {loyaltyMode === 'visits' ? (
            <Card>
              <CardHeader>
                <CardTitle>Configuración por visitas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="visits-required">Visitas necesarias para recompensa</Label>
                  <Input
                    id="visits-required"
                    type="number"
                    value={visitsForReward}
                    onChange={(e) => setVisitsForReward(parseInt(e.target.value))}
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de recompensa</Label>
                  <RadioGroup defaultValue="free-cut">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <RadioGroupItem value="free-cut" />
                      <span className="text-sm">Corte gratis</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <RadioGroupItem value="discount" />
                      <span className="text-sm">Descuento porcentual</span>
                    </label>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Configuración por puntos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="points-per-peso">Puntos por cada peso gastado</Label>
                  <Input
                    id="points-per-peso"
                    type="number"
                    value={pointsPerPeso}
                    onChange={(e) => setPointsPerPeso(parseInt(e.target.value))}
                    min="0.1"
                    step="0.1"
                  />
                  <p className="text-sm text-muted-foreground">
                    Ejemplo: Si un cliente gasta $5.000, recibe {5000 * pointsPerPeso} puntos
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button size="lg">Guardar configuración</Button>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clientes activos en el programa</CardTitle>
              <CardDescription>
                Seguimiento de puntos y próximas recompensas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sampleCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {customer.name.split(' ').map((n) => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">{customer.visits} visitas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="mb-1">
                        {customer.points} puntos
                      </Badge>
                      <p className="text-xs text-muted-foreground">{customer.nextReward}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Recompensas disponibles</h3>
              <p className="text-sm text-muted-foreground">
                Configurá las recompensas que los clientes pueden canjear
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {rewards.map((reward) => (
              <Card key={reward.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                        {reward.type === 'service' ? (
                          <Gift className="h-7 w-7 text-primary" />
                        ) : reward.type === 'discount' ? (
                          <TrendingUp className="h-7 w-7 text-primary" />
                        ) : (
                          <Award className="h-7 w-7 text-primary" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{reward.name}</h4>
                        {reward.duration && (
                          <p className="text-sm text-muted-foreground">Válido por {reward.duration}</p>
                        )}
                      </div>
                    </div>
                    <Badge className="text-base px-4 py-2">
                      {reward.points} puntos
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
