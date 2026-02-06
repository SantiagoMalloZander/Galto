'use client'

import React from "react"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowUp, ArrowDown, TrendingUp, DollarSign, Users, Scissors, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface MetricCardProps {
  title: string
  value: string
  change: number
  icon: React.ReactNode
}

function MetricCard({ title, value, change, icon }: MetricCardProps) {
  const isPositive = change >= 0

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            <div className="flex items-center gap-1 mt-2">
              {isPositive ? (
                <ArrowUp className="h-4 w-4 text-green-600" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(change)}%
              </span>
              <span className="text-sm text-muted-foreground">vs mes anterior</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedBranch, setSelectedBranch] = useState('all')

  const branches = [
    { id: 'all', name: 'Todas las sucursales' },
    { id: '1', name: 'Sucursal Centro' },
    { id: '2', name: 'Sucursal Palermo' },
  ]

  const topCustomers = [
    { name: 'Juan Pérez', visits: 12, spent: 84000 },
    { name: 'Carlos Gómez', visits: 10, spent: 72000 },
    { name: 'Diego Martínez', visits: 9, spent: 68000 },
    { name: 'Lucas García', visits: 8, spent: 62000 },
    { name: 'Martín Silva', visits: 7, spent: 58000 },
  ]

  const employeeStats = [
    { name: 'Carlos', cuts: 156, revenue: 780000, avgPerCut: 5000 },
    { name: 'Juan', cuts: 142, revenue: 720000, avgPerCut: 5070 },
    { name: 'Mateo', cuts: 128, revenue: 640000, avgPerCut: 5000 },
  ]

  const serviceStats = [
    { name: 'Corte clásico', count: 245, percentage: 45 },
    { name: 'Corte + Barba', count: 156, percentage: 28 },
    { name: 'Barba completa', count: 89, percentage: 16 },
    { name: 'Coloración', count: 61, percentage: 11 },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Analizá métricas y rendimiento de tu negocio
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as 'monthly' | 'yearly')}>
          <TabsList>
            <TabsTrigger value="monthly">Mensual</TabsTrigger>
            <TabsTrigger value="yearly">Anual</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-full sm:w-64">
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Servicios realizados"
          value="551"
          change={12.5}
          icon={<Scissors className="h-6 w-6 text-primary" />}
        />
        <MetricCard
          title="Facturación"
          value="$2.75M"
          change={8.3}
          icon={<DollarSign className="h-6 w-6 text-primary" />}
        />
        <MetricCard
          title="Ticket promedio"
          value="$5.000"
          change={-2.1}
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
        />
        <MetricCard
          title="Calificación"
          value="4.8"
          change={5.2}
          icon={<Star className="h-6 w-6 text-primary" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Reservas vs Walk-ins */}
        <Card>
          <CardHeader>
            <CardTitle>Visitas con reserva vs sin reserva</CardTitle>
            <CardDescription>Distribución de clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Con reserva online</span>
                  <span className="text-sm font-medium">68%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '68%' }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">375 visitas</p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Sin reserva (walk-in)</span>
                  <span className="text-sm font-medium">32%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-secondary" style={{ width: '32%' }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">176 visitas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Servicios más solicitados</CardTitle>
            <CardDescription>Por cantidad de veces</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serviceStats.map((service) => (
                <div key={service.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{service.name}</span>
                    <span className="text-sm text-muted-foreground">{service.count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${service.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 clientes</CardTitle>
            <CardDescription>Por gasto total del {period === 'monthly' ? 'mes' : 'año'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div
                  key={customer.name}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="h-8 w-8 rounded-full flex items-center justify-center p-0">
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.visits} visitas</p>
                    </div>
                  </div>
                  <p className="font-semibold">${customer.spent.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Employee Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Rendimiento de empleados</CardTitle>
            <CardDescription>Métricas del {period === 'monthly' ? 'mes' : 'año'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {employeeStats.map((employee) => (
                <div key={employee.name} className="p-4 rounded-lg border">
                  <p className="font-semibold mb-3">{employee.name}</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{employee.cuts}</p>
                      <p className="text-xs text-muted-foreground">Cortes</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        ${(employee.revenue / 1000).toFixed(0)}k
                      </p>
                      <p className="text-xs text-muted-foreground">Facturación</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        ${(employee.avgPerCut / 1000).toFixed(1)}k
                      </p>
                      <p className="text-xs text-muted-foreground">Promedio/corte</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
