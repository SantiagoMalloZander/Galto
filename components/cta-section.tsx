'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Phone, Mail } from 'lucide-react'
import { motion } from 'framer-motion'

export function CTASection() {
  return (
    <section id="contacto" className="py-16 sm:py-20 lg:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <Card className="max-w-4xl mx-auto p-8 sm:p-12 lg:p-16 bg-gradient-to-br from-primary/5 via-card/50 to-secondary/5 backdrop-blur-sm border-border text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
              ¿Querés probar GALTO en tu barbería?
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
              Agendá una demo gratis y descubrí cómo GALTO puede transformar tu negocio. Sin compromiso, sin costos ocultos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="bg-primary text-primary-foreground text-base" asChild>
                <a href="https://wa.me/5491123401136" target="_blank" rel="noopener noreferrer">
                  Agendar demo gratis
                </a>
              </Button>
              <Button size="lg" variant="outline" className="text-base bg-transparent" asChild>
                <a href="https://wa.me/5491123401136" target="_blank" rel="noopener noreferrer">
                  Hablar por WhatsApp
                </a>
              </Button>
            </div>

            <div className="border-t border-border pt-8">
              <p className="text-sm text-muted-foreground mb-4">O contactanos directamente:</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <a
                  href="https://wa.me/5491123401136"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span>+54 9 11 2340-1136</span>
                </a>
                <a
                  href="mailto:mzanderconsulting@gmail.com"
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  <span>mzanderconsulting@gmail.com</span>
                </a>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
