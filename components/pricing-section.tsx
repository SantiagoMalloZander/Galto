'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

const plans = [
  {
    name: 'Starter',
    tagline: 'Para barberías que arrancan',
    price: '49.900',
    period: '/mes',
    features: [
      'Gestión de turnos inteligente',
      'Recordatorios automáticos',
      'Hasta 150 turnos/mes',
      'Soporte por email',
      'Configuración incluida',
    ],
    cta: 'Empezar ahora',
    highlighted: false,
  },
  {
    name: 'Pro',
    tagline: 'Para negocios en crecimiento',
    price: '79.900',
    period: '/mes',
    badge: 'Popular',
    features: [
      'Todo lo de Starter, más:',
      'Reactivación de clientes',
      'Métricas y reportes avanzados',
      'Turnos ilimitados',
      'Soporte prioritario WhatsApp',
      'Optimización mensual',
    ],
    cta: 'Elegir Pro',
    highlighted: true,
  },
]

export function PricingSection() {
  return (
    <section id="precios" className="py-16 sm:py-20 lg:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
            Precios transparentes
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Sin sorpresas. Sin costos ocultos. Solo resultados.
          </p>
        </motion.div>

        {/* Demo banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-2 mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-foreground">
              Demo gratis — Probá sin compromiso
            </span>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card
                className={`p-6 sm:p-8 h-full relative ${
                  plan.highlighted
                    ? 'bg-primary/5 border-primary/30 shadow-xl'
                    : 'bg-card/50 backdrop-blur-sm border-border'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-foreground mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-muted-foreground">$</span>
                    <span className="text-4xl sm:text-5xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">IVA incluido</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.highlighted
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-transparent'
                  }`}
                  variant={plan.highlighted ? 'default' : 'outline'}
                  asChild
                >
                  <a href="#contacto">{plan.cta}</a>
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Additional info */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center space-y-4"
        >
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-accent" />
              <span>Sin mantenimiento</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-accent" />
              <span>Sin costos sorpresa</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-accent" />
              <span>Cancelá cuando quieras</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Ideal para Buenos Aires • Configuración incluida
          </p>
        </motion.div>
      </div>
    </section>
  )
}
