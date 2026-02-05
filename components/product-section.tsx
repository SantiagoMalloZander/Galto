'use client'

import { Card } from '@/components/ui/card'
import { Calendar, MessageCircle, Users, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'

const products = [
  {
    icon: Calendar,
    title: 'Gestión de turnos',
    description: 'Agenda inteligente que organiza tu día y maximiza cada hora disponible.',
  },
  {
    icon: MessageCircle,
    title: 'Confirmaciones y recordatorios',
    description: 'Mensajes automáticos por WhatsApp para reducir ausencias y cancelaciones.',
  },
  {
    icon: Users,
    title: 'Reactivación de clientes',
    description: 'Recuperá clientes inactivos con seguimiento personalizado y ofertas dirigidas.',
  },
  {
    icon: BarChart3,
    title: 'Métricas simples',
    description: 'Ocupación, ingresos estimados y tendencias mes a mes en un solo lugar.',
  },
]

export function ProductSection() {
  return (
    <section id="producto" className="py-16 sm:py-20 lg:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-20 left-0 w-72 h-72 bg-secondary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
            Todo lo que necesitás en un solo sistema
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            GALTO reúne las herramientas esenciales para gestionar y hacer crecer tu barbería o peluquería.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {products.map((product, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="p-6 sm:p-8 h-full bg-card/50 backdrop-blur-sm border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg group">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <product.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                      {product.title}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Sin jerga técnica. Sin promesas de IA. Solo resultados concretos para tu negocio.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
