'use client'

import { Card } from '@/components/ui/card'
import { TrendingDown, TrendingUp, Users, Eye } from 'lucide-react'
import { motion } from 'framer-motion'

const metrics = [
  {
    icon: TrendingDown,
    title: 'Menos ausencias',
    description: 'Recordatorios automáticos reducen cancelaciones de último momento.',
  },
  {
    icon: TrendingUp,
    title: 'Más ocupación semanal',
    description: 'Espacios vacíos que se llenan con reactivación y mejor organización.',
  },
  {
    icon: Users,
    title: 'Más clientes recurrentes',
    description: 'Seguimiento personalizado que mantiene clientes activos y satisfechos.',
  },
  {
    icon: Eye,
    title: 'Visibilidad del negocio',
    description: 'Datos claros para tomar decisiones y ajustar tu estrategia.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Audit rápido',
    description: '15 minutos para entender tu negocio y necesidades específicas.',
  },
  {
    number: '02',
    title: 'Configuración',
    description: '48–72 horas para tener todo listo y funcionando.',
  },
  {
    number: '03',
    title: 'Optimización continua',
    description: 'Revisiones mensuales para ajustar y mejorar resultados.',
  },
]

export function ResultsSection() {
  return (
    <section id="resultados" className="py-16 sm:py-20 lg:py-32 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-40 right-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-40 left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
            Resultados que importan
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Menos caos, más ingresos. Así de simple.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 sm:mb-20 lg:mb-24">
          {metrics.map((metric, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="p-6 text-center h-full bg-card/50 backdrop-blur-sm border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg group">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors mb-4">
                  <metric.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{metric.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{metric.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            ¿Cómo funciona?
          </h3>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Tres pasos simples para transformar tu barbería o peluquería
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 mb-4">
                  <span className="text-2xl font-bold text-primary">{step.number}</span>
                </div>
                <h4 className="text-xl font-semibold text-foreground mb-2">{step.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
              
              {/* Connection line (hidden on mobile) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-primary/20 to-transparent" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
