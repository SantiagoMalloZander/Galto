'use client'

import { Button } from '@/components/ui/button'
import { MessageCircle, Mail } from 'lucide-react'
import { motion } from 'framer-motion'

export function CTASection() {
  return (
    <section className="py-24 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative max-w-4xl mx-auto"
        >
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 rounded-3xl blur-3xl -z-10" />

          <div className="bg-card rounded-3xl p-8 md:p-12 border border-border shadow-xl text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-balance mb-4">
              {'Listo para llenar tu agenda?'}
            </h2>
            <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto mb-8">
              {'Empezá tu prueba gratis de 14 días. Sin tarjeta. Sin compromiso. Solo vos y una agenda llena de clientes.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button size="lg" className="text-base font-medium" asChild>
                <a
                  href="https://wa.me/5491123401136"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  {'Agendar demo gratis'}
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base font-medium"
                asChild
              >
                <a
                  href="mailto:mzanderconsulting@gmail.com"
                  className="flex items-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  {'Escribinos un email'}
                </a>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {'Respondemos en menos de 2 horas • Lun-Vie 9-18hs'}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
