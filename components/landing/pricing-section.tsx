'use client'

import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { motion } from 'framer-motion'

export function PricingSection() {
  const plans = [
    {
      name: 'Starter',
      price: '29.900',
      period: '/mes',
      description: 'Para barberías que recién arrancan con reservas online',
      features: [
        'Hasta 200 reservas/mes',
        '1 sucursal',
        'Hasta 3 barberos',
        'Recordatorios WhatsApp',
        'Página de reservas personalizada',
        'Soporte por email',
      ],
      cta: 'Empezar gratis',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '54.900',
      period: '/mes',
      description: 'Para barberías que quieren crecer y profesionalizarse',
      features: [
        'Reservas ilimitadas',
        'Hasta 3 sucursales',
        'Barberos ilimitados',
        'Recordatorios + Reactivación',
        'Dashboard de métricas',
        'Lead Finder (encuentra nuevos clientes)',
        'Sistema de puntos y recompensas',
        'Soporte prioritario por WhatsApp',
      ],
      cta: 'Empezar gratis',
      highlighted: true,
    },
  ]

  return (
    <section className="py-24 md:py-32 bg-muted/30" id="precios">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-balance mb-4">
            {'Precios transparentes'}
          </h2>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            {'Sin permanencia. Cancelá cuando quieras. 14 días de prueba gratis.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative rounded-2xl p-8 ${
                plan.highlighted
                  ? 'bg-primary text-primary-foreground shadow-2xl ring-2 ring-primary scale-105'
                  : 'bg-card border border-border'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  {'Más popular'}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-display font-bold mb-2">
                  {plan.name}
                </h3>
                <p
                  className={`text-sm text-pretty ${
                    plan.highlighted
                      ? 'text-primary-foreground/80'
                      : 'text-muted-foreground'
                  }`}
                >
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-semibold">{'$'}</span>
                  <span className="text-5xl font-display font-bold">
                    {plan.price}
                  </span>
                  <span
                    className={`text-lg ${
                      plan.highlighted
                        ? 'text-primary-foreground/80'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {plan.period}
                  </span>
                </div>
                <p
                  className={`text-sm mt-1 ${
                    plan.highlighted
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  }`}
                >
                  {'+ IVA'}
                </p>
              </div>

              <Button
                size="lg"
                className={`w-full mb-8 ${
                  plan.highlighted
                    ? 'bg-background text-foreground hover:bg-background/90'
                    : ''
                }`}
                asChild
              >
                <a
                  href="https://wa.me/5491123401136"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {plan.cta}
                </a>
              </Button>

              <ul className="space-y-4">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        plan.highlighted
                          ? 'bg-primary-foreground/20'
                          : 'bg-primary/10'
                      }`}
                    >
                      <Check
                        className={`w-3 h-3 ${
                          plan.highlighted
                            ? 'text-primary-foreground'
                            : 'text-primary'
                        }`}
                      />
                    </div>
                    <span className="text-sm text-pretty leading-relaxed">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            {'¿Necesitás más de 3 sucursales? '}
            <a
              href="https://wa.me/5491123401136"
              className="text-primary hover:underline font-medium"
            >
              {'Hablemos de un plan Enterprise'}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
