'use client'

import { TrendingUp, Users, Clock, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export function ResultsSection() {
  const stats = [
    {
      icon: TrendingUp,
      value: '+35%',
      label: 'Aumento promedio en reservas',
    },
    {
      icon: Clock,
      value: '8hs',
      label: 'Ahorradas por semana',
    },
    {
      icon: Users,
      value: '70%',
      label: 'Menos ausencias',
    },
    {
      icon: Sparkles,
      value: '4.9/5',
      label: 'Satisfacción de usuarios',
    },
  ]

  const steps = [
    {
      number: '01',
      title: 'Configurá tu barbería',
      description:
        'Cargá tus servicios, barberos y horarios. Te lleva 10 minutos.',
    },
    {
      number: '02',
      title: 'Compartí tu link',
      description:
        'Enviá tu página de reservas por WhatsApp, Instagram o ponela en tu bio.',
    },
    {
      number: '03',
      title: 'Dejá que trabaje solo',
      description:
        'GALTO recibe reservas, manda recordatorios y llena tu agenda automáticamente.',
    },
  ]

  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Stats Grid */}
        <div className="mb-24">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-balance text-center mb-16">
            {'Resultados que hablan solos'}
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-card rounded-2xl p-6 border border-border text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl font-display font-bold text-primary mb-2">
                  {stat.value}
                </div>
                <p className="text-sm text-muted-foreground text-balance">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-balance text-center mb-4">
            {'Empezá en 3 pasos'}
          </h2>
          <p className="text-lg text-muted-foreground text-pretty text-center max-w-2xl mx-auto mb-16">
            {'Sin instalaciones complicadas. Sin capacitación. Lo configurás una vez y funciona para siempre.'}
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                viewport={{ once: true }}
                className="relative"
              >
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-transparent -translate-y-1/2 z-0" />
                )}

                <div className="relative bg-card rounded-2xl p-8 border border-border hover:shadow-lg transition-shadow">
                  <div className="text-5xl font-display font-bold text-primary/20 mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-balance">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-pretty leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
