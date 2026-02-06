'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Download, Printer, Calendar as CalendarIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Booking {
  id: string
  time: string
  service: string
  customer: string
  employee: string
  employeeColor: string
  duration: number
}

const sampleBookings: Booking[] = [
  { id: '1', time: '09:00', service: 'Corte clásico', customer: 'Juan Pérez', employee: 'Carlos', employeeColor: 'bg-blue-500', duration: 30 },
  { id: '2', time: '09:30', service: 'Barba', customer: 'Pedro López', employee: 'Juan', employeeColor: 'bg-green-500', duration: 25 },
  { id: '3', time: '10:00', service: 'Corte + Barba', customer: 'Diego Martínez', employee: 'Carlos', employeeColor: 'bg-blue-500', duration: 45 },
  { id: '4', time: '11:00', service: 'Corte clásico', customer: 'Lucas García', employee: 'Mateo', employeeColor: 'bg-purple-500', duration: 30 },
  { id: '5', time: '14:00', service: 'Coloración', customer: 'Ana Rodríguez', employee: 'Juan', employeeColor: 'bg-green-500', duration: 60 },
  { id: '6', time: '15:00', service: 'Corte clásico', customer: 'Martín Silva', employee: 'Mateo', employeeColor: 'bg-purple-500', duration: 30 },
]

export default function CalendarioPage() {
  const [view, setView] = useState<'daily' | 'weekly'>('daily')
  const [selectedBranch, setSelectedBranch] = useState('1')
  const [filterEmployee, setFilterEmployee] = useState('all')
  const [filterService, setFilterService] = useState('all')
  const [currentDate, setCurrentDate] = useState(new Date())

  const branches = [
    { id: '1', name: 'Sucursal Centro' },
    { id: '2', name: 'Sucursal Palermo' },
  ]

  const employees = [
    { id: '1', name: 'Carlos', color: 'bg-blue-500' },
    { id: '2', name: 'Juan', color: 'bg-green-500' },
    { id: '3', name: 'Mateo', color: 'bg-purple-500' },
  ]

  const services = ['Corte clásico', 'Corte + Barba', 'Barba', 'Coloración']

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30',
  ]

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  const getWeekDays = (date: Date) => {
    const week = []
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay() + 1) // Monday
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      week.push(day)
    }
    return week
  }

  const filteredBookings = sampleBookings.filter((booking) => {
    if (filterEmployee !== 'all' && booking.employee !== filterEmployee) return false
    if (filterService !== 'all' && booking.service !== filterService) return false
    return true
  })

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">Calendario</h1>
        <p className="text-muted-foreground">
          Visualizá y gestioná todas las reservas
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger>
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los empleados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los empleados</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.name}>
                {emp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterService} onValueChange={setFilterService}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los servicios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los servicios</SelectItem>
            {services.map((service) => (
              <SelectItem key={service} value={service}>
                {service}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" className="gap-2 bg-transparent">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>

        <Button variant="outline" className="gap-2 bg-transparent">
          <Printer className="h-4 w-4" />
          <span className="hidden sm:inline">Imprimir</span>
        </Button>
      </div>

      {/* View Selector + Date Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Tabs value={view} onValueChange={(v) => setView(v as 'daily' | 'weekly')}>
          <TabsList>
            <TabsTrigger value="daily">Diario</TabsTrigger>
            <TabsTrigger value="weekly">Semanal</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setDate(currentDate.getDate() - (view === 'daily' ? 1 : 7))
              setCurrentDate(newDate)
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <p className="font-semibold capitalize">{formatDate(currentDate)}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setDate(currentDate.getDate() + (view === 'daily' ? 1 : 7))
              setCurrentDate(newDate)
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoy
          </Button>
        </div>
      </div>

      {/* Employee Legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {employees.map((emp) => (
          <div key={emp.id} className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded ${emp.color}`} />
            <span className="text-sm">{emp.name}</span>
          </div>
        ))}
      </div>

      {/* Calendar View */}
      {view === 'daily' ? (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              {timeSlots.map((time) => {
                const bookingsAtTime = filteredBookings.filter((b) => b.time === time)
                return (
                  <div
                    key={time}
                    className="grid grid-cols-[80px_1fr] gap-3 py-2 border-b last:border-0"
                  >
                    <div className="text-sm text-muted-foreground font-medium pt-1">
                      {time}
                    </div>
                    <div className="space-y-2">
                      {bookingsAtTime.length > 0 ? (
                        bookingsAtTime.map((booking) => (
                          <div
                            key={booking.id}
                            className={`${booking.employeeColor} text-white p-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
                          >
                            <p className="font-medium text-sm">{booking.service}</p>
                            <p className="text-xs opacity-90">{booking.customer}</p>
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-xs opacity-75">{booking.employee}</p>
                              <p className="text-xs opacity-75">{booking.duration} min</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="h-12 border-2 border-dashed border-muted-foreground/20 rounded-lg" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-2 mb-2">
                <div className="text-sm font-medium text-muted-foreground">Hora</div>
                {getWeekDays(currentDate).map((day, i) => (
                  <div key={i} className="text-center">
                    <p className="text-sm font-medium capitalize">
                      {day.toLocaleDateString('es-AR', { weekday: 'short' })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {day.getDate()}/{day.getMonth() + 1}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {timeSlots.slice(0, 12).map((time) => (
                  <div key={time} className="grid grid-cols-[80px_repeat(7,1fr)] gap-2">
                    <div className="text-xs text-muted-foreground py-2">{time}</div>
                    {getWeekDays(currentDate).map((day, i) => {
                      const booking = i < 3 ? filteredBookings[Math.floor(Math.random() * filteredBookings.length)] : null
                      return (
                        <div key={i} className="min-h-[60px]">
                          {booking && Math.random() > 0.7 ? (
                            <div
                              className={`${booking.employeeColor} text-white p-2 rounded text-xs cursor-pointer hover:opacity-90`}
                            >
                              <p className="font-medium truncate">{booking.service}</p>
                              <p className="opacity-75 truncate">{booking.customer}</p>
                            </div>
                          ) : (
                            <div className="h-full border border-dashed border-muted-foreground/10 rounded" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
