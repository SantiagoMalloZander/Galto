'use client'

import { useEffect, useMemo, useState } from 'react'
import { BrainCircuit, Calendar, MessageSquare, SquareChartGantt } from 'lucide-react'
import type { ComponentType } from 'react'

const slots = [
  { time: '09:00', label: 'Hueco' },
  { time: '10:00', label: 'Hueco' },
  { time: '11:00', label: 'Hueco' },
  { time: '12:00', label: 'Hueco' },
  { time: '14:00', label: 'Hueco' },
  { time: '15:00', label: 'Hueco' },
]

const filledRows = [
  { time: '09:00', customer: 'Juan M.', service: 'Corte clasico' },
  { time: '10:00', customer: 'Lucia R.', service: 'Color + brushing' },
  { time: '11:00', customer: 'Mauro C.', service: 'Barba + fade' },
  { time: '12:00', customer: 'Nadia P.', service: 'Limpieza facial' },
  { time: '14:00', customer: 'Tomas V.', service: 'Corte + perfilado' },
  { time: '15:00', customer: 'Romina A.', service: 'Peinado social' },
]

export function PredictiveAISection() {
  const [activeCount, setActiveCount] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveCount((prev) => {
        if (prev >= filledRows.length) {
          return 0
        }
        return prev + 1
      })
    }, 900)
    return () => window.clearInterval(timer)
  }, [])

  const animatedRows = useMemo(() => filledRows.slice(0, activeCount), [activeCount])

  return (
    <section id="demo" className="bg-[#FAF7F2] py-24 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-12">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <span className="inline-block rounded-full bg-[#E8634A]/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E8634A]">
            Demo visual
          </span>
          <h2 className="mt-6 text-balance text-4xl font-bold leading-tight text-[#1A1A1A] sm:text-5xl md:text-6xl">
            Agenda vacia al inicio.
            <br />
            Agenda llena al final.
          </h2>
          <p className="mt-5 text-lg text-[#1A1A1A]/50 md:text-xl">
            Asi se ve Galto trabajando con tus datos: detecta huecos, acciona mensajes y te deja el calendario completo.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Calendar animation */}
          <div className="rounded-[2rem] bg-white p-6 shadow-[0_2px_40px_rgba(0,0,0,0.04)] md:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">Calendario inteligente</p>
                <p className="text-xs text-[#1A1A1A]/40">Agenda vacia → agenda llena</p>
              </div>
              <span className="rounded-full bg-[#1A1A1A] px-4 py-1.5 text-xs font-semibold text-white">
                {animatedRows.length}/{filledRows.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {slots.map((slot, index) => {
                const row = animatedRows[index]
                return (
                  <div
                    key={slot.time}
                    className={`rounded-2xl border px-4 py-3 transition-all duration-500 ${
                      row
                        ? 'border-[#4CAF79]/20 bg-[#4CAF79]/5'
                        : 'border-[#F0ECE4] bg-[#FDFCFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Calendar className={`h-4 w-4 ${row ? 'text-[#4CAF79]' : 'text-[#1A1A1A]/25'}`} />
                        <p className="text-sm font-semibold text-[#1A1A1A]">{slot.time}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          row ? 'bg-[#4CAF79] text-white' : 'bg-[#F0ECE4] text-[#1A1A1A]/40'
                        }`}
                      >
                        {row ? 'Confirmado' : slot.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#1A1A1A]/40">
                      {row ? `${row.customer} · ${row.service}` : 'Sin cliente asignado'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid gap-5">
            <MockCard
              icon={SquareChartGantt}
              title="Dashboard real"
              body="Ves ocupacion, facturacion y servicios top por sucursal en segundos."
              variant="dark"
            />
            <MockCard
              icon={MessageSquare}
              title="IA enviando mensajes"
              body="Recontacto personalizado para horarios flojos. Menos huecos y mas conversiones."
              variant="coral"
            />
            <MockCard
              icon={BrainCircuit}
              title="Motor predictivo"
              body="Detecta patrones por servicio y sugiere cuando contactar para no perder al cliente."
              variant="light"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function MockCard({
  icon: Icon,
  title,
  body,
  variant,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  body: string
  variant: 'dark' | 'coral' | 'light'
}) {
  const styles = {
    dark: 'bg-[#1A1A1A] text-white',
    coral: 'bg-[#E8634A] text-white',
    light: 'bg-white border border-[#F0ECE4] text-[#1A1A1A]',
  } as const

  return (
    <article className={`rounded-[2rem] p-6 shadow-[0_2px_30px_rgba(0,0,0,0.04)] ${styles[variant]}`}>
      <div className={`mb-3 inline-flex rounded-xl p-2.5 ${variant === 'light' ? 'bg-[#FAF7F2]' : 'bg-white/15'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className={`mt-2 text-sm leading-relaxed ${variant === 'light' ? 'text-[#1A1A1A]/50' : 'text-white/70'}`}>
        {body}
      </p>
    </article>
  )
}
