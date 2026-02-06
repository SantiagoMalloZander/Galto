'use client'

import { Button } from '@/components/ui/button'
import { Calendar, Bell, TrendingUp, Users } from 'lucide-react'
import { motion } from 'framer-motion'

export function Hero() {
  return (
    <section className="relative pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-balance leading-tight mb-6">
              {'Más reservas.'}
              <br />
              <span className="text-primary">{'Cero huecos.'}</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground text-pretty leading-relaxed mb-8">
              {'El sistema que ayuda a barberías y peluquerías en Buenos Aires a llenar cada hueco de su agenda con reservas automatizadas.'}
            </p>

            {/* Value Props */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {[
                { icon: Calendar, text: 'Reservas 24/7' },
                { icon: Bell, text: 'Recordatorios auto' },
                { icon: TrendingUp, text: 'Más ingresos' },
                { icon: Users, text: 'Clientes felices' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild className="text-base font-medium">
                <a
                  href="https://wa.me/5491123401136"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {'Agendar demo gratis'}
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="text-base font-medium"
              >
                <a href="#producto">{'Ver cómo funciona'}</a>
              </Button>
            </div>

            {/* Social Proof */}
            <p className="text-sm text-muted-foreground mt-8">
              {'Usado por más de '}
              <span className="font-semibold text-foreground">{'50+ barberías'}</span>
              {' en Buenos Aires'}
            </p>
          </motion.div>

          {/* Right Content - Product Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-6 backdrop-blur-sm border border-border shadow-2xl">
              {/* Mock Calendar Interface */}
              <div className="bg-card rounded-xl p-4 h-full shadow-lg border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-sm">
                      {'Miércoles 15 Febrero'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {'9 reservas hoy'}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                </div>

                {/* Mock Appointments */}
                <div className="space-y-2">
                  {[
                    { time: '09:00', service: 'Corte + Barba', client: 'Juan P.' },
                    { time: '10:30', service: 'Corte fade', client: 'Martin L.' },
                    { time: '12:00', service: 'Barba deluxe', client: 'Diego R.' },
                  ].map((apt, i) => (
                    <div
                      key={i}
                      className="bg-primary/5 rounded-lg p-3 border border-primary/10"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold text-primary">
                            {apt.time}
                          </p>
                          <p className="text-sm font-medium mt-1">
                            {apt.service}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {apt.client}
                          </p>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-primary/20" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating Notification */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="absolute -bottom-4 -right-4 bg-card rounded-xl p-4 shadow-xl border border-border max-w-[200px]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{'Nueva reserva'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {'Carlos confirmó para mañana 15:00'}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
