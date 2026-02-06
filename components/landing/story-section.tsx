'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, Zap, BarChart3 } from 'lucide-react'

export function StorySection() {
  const [activePanel, setActivePanel] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return

      const section = sectionRef.current
      const rect = section.getBoundingClientRect()
      const sectionHeight = rect.height
      const viewportHeight = window.innerHeight

      // Calculate how far through the section we've scrolled
      const scrollProgress = Math.max(
        0,
        Math.min(1, (viewportHeight / 2 - rect.top) / (sectionHeight / 2))
      )

      // Update active panel based on scroll progress
      if (scrollProgress < 0.33) {
        setActivePanel(0)
      } else if (scrollProgress < 0.66) {
        setActivePanel(1)
      } else {
        setActivePanel(2)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const panels = [
    {
      icon: Calendar,
      title: 'Tu agenda, siempre llena',
      description:
        'Los clientes reservan online 24/7. Vos solo mirás tu calendario y cortás. Sin WhatsApp, sin llamadas perdidas.',
      color: 'primary',
    },
    {
      icon: Zap,
      title: 'Cero ausentes',
      description:
        'Recordatorios automáticos por WhatsApp 24hs antes. Tus clientes llegan a horario y vos no perdés tiempo ni plata.',
      color: 'secondary',
    },
    {
      icon: BarChart3,
      title: 'Más clientes, más ingresos',
      description:
        'Reactivá clientes que dejaron de venir. Mirá métricas en tiempo real. Crecé tu negocio con datos, no con intuición.',
      color: 'accent',
    },
  ]

  return (
    <section ref={sectionRef} className="py-24 md:py-32 relative" id="producto">
      {/* Background Patterns */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div
          className={`absolute top-1/4 left-10 w-64 h-64 rounded-full blur-3xl transition-opacity duration-1000 ${
            activePanel === 0 ? 'opacity-20' : 'opacity-0'
          } bg-primary`}
        />
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl transition-opacity duration-1000 ${
            activePanel === 1 ? 'opacity-20' : 'opacity-0'
          } bg-secondary`}
        />
        <div
          className={`absolute top-1/4 right-10 w-64 h-64 rounded-full blur-3xl transition-opacity duration-1000 ${
            activePanel === 2 ? 'opacity-20' : 'opacity-0'
          } bg-accent`}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-balance mb-4">
            {'Cómo GALTO transforma tu barbería'}
          </h2>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            {'Automatizá lo aburrido. Enfocate en lo que importa: cortar pelo.'}
          </p>
        </div>

        {/* Story Panels */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {panels.map((panel, index) => (
            <div
              key={index}
              className={`relative p-8 rounded-2xl border transition-all duration-500 ${
                activePanel === index
                  ? 'bg-card shadow-xl scale-105 border-primary'
                  : 'bg-card/50 border-border scale-100'
              }`}
            >
              {/* Icon */}
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-colors duration-500 ${
                  activePanel === index
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                <panel.icon className="w-7 h-7" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-display font-bold mb-3 text-balance">
                {panel.title}
              </h3>
              <p className="text-muted-foreground text-pretty leading-relaxed">
                {panel.description}
              </p>

              {/* Progress Indicator */}
              <div className="mt-6 flex gap-1.5">
                {panels.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full flex-1 transition-colors duration-500 ${
                      i === index
                        ? 'bg-primary'
                        : i < activePanel
                          ? 'bg-primary/30'
                          : 'bg-border'
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Scroll Hint */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            {'Seguí scrolleando para ver más'}
          </p>
        </div>
      </div>
    </section>
  )
}
