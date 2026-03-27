'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'

const plans = [
  {
    id: 'DEMO',
    name: 'Gratis',
    subtitle: 'Para empezar sin friccion',
    features: ['1 sucursal', 'Agenda online', 'Calendario', 'Clientes', 'Centro de cuentas'],
    cta: 'Empezar gratis',
    href: '/login?plan=DEMO',
    highlighted: false,
  },
  {
    id: 'PAID_FULL',
    name: 'Profesional',
    subtitle: 'Para crecer en serio',
    features: [
      'Todo lo del plan gratis',
      'Lead Finder con IA',
      'Dashboard completo',
      'Puntos + recompensas',
      'Escala por sucursal',
    ],
    cta: 'Quiero plan profesional',
    href: '/login?plan=PAID_FULL',
    highlighted: true,
  },
]

export function PricingSection() {
  return (
    <section id="precios" className="bg-white py-24 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-5xl px-5 lg:px-12">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-bold leading-tight text-[#1A1A1A] sm:text-5xl md:text-6xl">
            Planes simples
          </h2>
          <p className="mt-5 text-lg text-[#1A1A1A]/50">
            Elegi como arrancar hoy. Despues podes cambiar cuando quieras.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`relative rounded-[2rem] p-8 md:p-10 ${
                plan.highlighted
                  ? 'bg-[#1A1A1A] text-white shadow-[0_24px_80px_rgba(0,0,0,0.15)]'
                  : 'border border-[#F0ECE4] bg-[#FDFCFA]'
              }`}
            >
              {plan.highlighted ? (
                <span className="inline-flex rounded-full bg-[#E8634A] px-4 py-1.5 text-xs font-semibold text-white">
                  Recomendado
                </span>
              ) : null}
              <h3 className={`mt-4 text-3xl font-bold ${plan.highlighted ? 'text-white' : 'text-[#1A1A1A]'}`}>
                {plan.name}
              </h3>
              <p className={`mt-2 text-sm ${plan.highlighted ? 'text-white/50' : 'text-[#1A1A1A]/50'}`}>
                {plan.subtitle}
              </p>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                        plan.highlighted ? 'bg-[#E8634A]' : 'bg-[#E8634A]/10'
                      }`}
                    >
                      <Check className={`h-3 w-3 ${plan.highlighted ? 'text-white' : 'text-[#E8634A]'}`} />
                    </div>
                    <span className={`text-sm ${plan.highlighted ? 'text-white/70' : 'text-[#1A1A1A]/60'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? 'bg-[#E8634A] text-white hover:bg-[#D4532E] hover:shadow-[0_8px_24px_rgba(232,99,74,0.3)]'
                    : 'bg-[#1A1A1A] text-white hover:bg-[#333]'
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
