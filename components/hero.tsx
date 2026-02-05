'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check, Calendar, MessageSquare, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

export function Hero() {
  return (
    <section className="relative pt-24 sm:pt-28 lg:pt-32 pb-16 sm:pb-20 lg:pb-32 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 right-10 w-64 h-64 sm:w-96 sm:h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-64 h-64 sm:w-80 sm:h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground mb-6 leading-tight text-balance">
              Más reservas.{' '}
              <span className="text-primary">Cero huecos.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0 text-pretty">
              GALTO te ayuda a ordenar turnos, llenar espacios vacíos y medir tu negocio mes a mes.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8">
              <Check className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-foreground">Demo gratis — Probá sin compromiso</span>
            </div>

            {/* Value Props */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto lg:mx-0">
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">Reservas sin caos</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">Recordatorios automáticos</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">Clientes que vuelven</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button size="lg" className="bg-primary text-primary-foreground text-base" asChild>
                <a href="#contacto">Agendar demo gratis</a>
              </Button>
              <Button size="lg" variant="outline" className="text-base bg-transparent" asChild>
                <a href="https://wa.me/5491123401136" target="_blank" rel="noopener noreferrer">
                  Hablar por WhatsApp
                </a>
              </Button>
            </div>
          </motion.div>

          {/* Right Column - Product Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border shadow-2xl">
              <div className="space-y-4">
                {/* Dashboard Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">Dashboard</h3>
                  <div className="text-sm text-muted-foreground">Hoy • 14 Dic</div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="text-2xl font-bold text-primary mb-1">18</div>
                    <div className="text-xs text-muted-foreground">Turnos hoy</div>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/10">
                    <div className="text-2xl font-bold text-secondary mb-1">94%</div>
                    <div className="text-xs text-muted-foreground">Ocupación</div>
                  </div>
                </div>

                {/* Calendar View */}
                <div className="space-y-2">
                  {[
                    { time: '10:00', client: 'Juan Pérez', service: 'Corte + Barba', status: 'confirmed' },
                    { time: '11:30', client: 'Carlos López', service: 'Corte clásico', status: 'confirmed' },
                    { time: '13:00', client: 'Disponible', service: '', status: 'available' },
                  ].map((appointment, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        appointment.status === 'available'
                          ? 'bg-accent/5 border-accent/20 border-dashed'
                          : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-semibold text-foreground">{appointment.time}</div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{appointment.client}</div>
                            {appointment.service && (
                              <div className="text-xs text-muted-foreground">{appointment.service}</div>
                            )}
                          </div>
                        </div>
                        {appointment.status === 'confirmed' && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Floating mobile mockup */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="absolute -bottom-8 -left-8 w-48 sm:w-56"
            >
              <Card className="p-4 bg-card border-border shadow-xl">
                <div className="text-xs font-semibold text-foreground mb-2">Recordatorio enviado</div>
                <div className="text-xs text-muted-foreground mb-2">
                  Hola Juan! Te esperamos mañana a las 10:00 para tu corte + barba.
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-accent">WhatsApp</span>
                  <Check className="w-3 h-3 text-accent" />
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>

        {/* Trust Strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 sm:mt-20 lg:mt-24 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-muted/50 border border-border">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">
              Hecho para barberías y peluquerías de Buenos Aires
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
