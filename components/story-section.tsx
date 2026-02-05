'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const stories = [
  {
    number: '01',
    title: 'Mantenerte a la cabeza',
    description: 'Procesos claros, automatización y datos para moverte más rápido.',
    bgShape: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)',
  },
  {
    number: '02',
    title: 'Proteger lo que construiste',
    description: 'Menos ausencias, confirmaciones y recordatorios para reducir pérdidas.',
    bgShape: 'polygon(0 15%, 100% 0, 100% 100%, 0 85%)',
  },
  {
    number: '03',
    title: 'Crear nuevo valor',
    description: 'Reactivación de clientes y seguimiento para crecer mes a mes.',
    bgShape: 'polygon(0 0, 100% 15%, 100% 100%, 0 100%)',
  },
]

export function StorySection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [hasScrolledPast, setHasScrolledPast] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return

      const section = sectionRef.current
      const rect = section.getBoundingClientRect()
      const sectionHeight = rect.height
      const viewportHeight = window.innerHeight

      // Check if we've scrolled past the section
      if (rect.bottom < 0) {
        setHasScrolledPast(true)
        return
      }

      // Reset if scrolling back up
      if (rect.top > viewportHeight) {
        setHasScrolledPast(false)
        setActiveIndex(0)
        return
      }

      // If section is in view and not scrolled past
      if (rect.top <= 0 && rect.bottom > viewportHeight) {
        setHasScrolledPast(false)
        const scrollProgress = Math.abs(rect.top) / (sectionHeight - viewportHeight)
        const newIndex = Math.min(Math.floor(scrollProgress * stories.length), stories.length - 1)
        setActiveIndex(newIndex)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section
      id="enfoque"
      ref={sectionRef}
      className="relative min-h-[300vh]"
      style={{ marginBottom: hasScrolledPast ? '0' : '0' }}
    >
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 -z-10">
          {stories.map((story, index) => (
            <motion.div
              key={index}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: activeIndex === index ? 0.1 : 0 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className="absolute w-full h-full bg-gradient-to-br from-primary to-secondary"
                style={{ clipPath: story.bgShape }}
              />
            </motion.div>
          ))}
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Progress Indicator */}
            <div className="flex items-center justify-center gap-2 mb-12">
              {stories.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    index === activeIndex ? 'w-12 bg-primary' : 'w-8 bg-border'
                  }`}
                />
              ))}
            </div>

            {/* Story Content */}
            {stories.map((story, index) => (
              <motion.div
                key={index}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: activeIndex === index ? 1 : 0,
                  y: activeIndex === index ? 0 : 20,
                  display: activeIndex === index ? 'block' : 'none',
                }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-6xl sm:text-7xl lg:text-8xl font-bold text-primary/20 mb-4">
                  {story.number}
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
                  {story.title}
                </h2>
                <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
                  {story.description}
                </p>
              </motion.div>
            ))}

            {/* Step Counter */}
            <div className="mt-12 text-center">
              <span className="text-sm font-medium text-muted-foreground">
                {String(activeIndex + 1).padStart(2, '0')} / {String(stories.length).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
