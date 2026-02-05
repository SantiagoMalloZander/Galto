'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { motion } from 'framer-motion'

const faqs = [
  {
    question: '¿Cuánto tarda la configuración?',
    answer:
      'Entre 48 y 72 horas tenés todo funcionando. Primero hacemos un audit rápido de 15 minutos para entender tu negocio, después configuramos el sistema, y finalmente te damos una sesión de onboarding para que arranques sin dudas.',
  },
  {
    question: '¿Necesito saber de tecnología?',
    answer:
      'No. GALTO está diseñado para que cualquiera pueda usarlo sin conocimientos técnicos. Si sabés usar WhatsApp, podés usar GALTO. Además, te ayudamos en la configuración inicial y estamos disponibles para cualquier duda.',
  },
  {
    question: '¿Cómo funcionan los recordatorios por WhatsApp?',
    answer:
      'GALTO se integra con tu número de WhatsApp (o podemos darte uno nuevo) para enviar recordatorios automáticos a tus clientes. Los mensajes se personalizan con el nombre del cliente, hora del turno y servicio. Todo automático.',
  },
  {
    question: '¿Mis datos están seguros?',
    answer:
      'Sí. Tus datos y los de tus clientes están protegidos con encriptación de nivel bancario. Solo vos tenés acceso a tu información. Cumplimos con todas las regulaciones de protección de datos de Argentina.',
  },
  {
    question: '¿Puedo cancelar en cualquier momento?',
    answer:
      'Sí. No hay contratos largos ni penalizaciones. Pagás mes a mes y podés cancelar cuando quieras. Si cancelás, tus datos quedan disponibles para descarga durante 30 días.',
  },
  {
    question: '¿Hay algún límite de clientes o turnos?',
    answer:
      'En el plan Starter tenés hasta 150 turnos por mes, ideal para arrancar. En el plan Pro, los turnos son ilimitados. No hay límite de clientes almacenados en ninguno de los planes.',
  },
  {
    question: '¿Funciona solo en Buenos Aires?',
    answer:
      'GALTO está optimizado para barberías y peluquerías de Buenos Aires (horarios, zona horaria, idioma), pero funciona en cualquier parte de Argentina. Si estás en otra provincia, también podés usarlo.',
  },
  {
    question: '¿Ofrecen soporte?',
    answer:
      'Sí. En el plan Starter tenés soporte por email en menos de 24 horas. En el plan Pro, tenés soporte prioritario por WhatsApp con respuesta en pocas horas. También incluimos optimización mensual para ajustar el sistema según tu negocio.',
  },
]

export function FAQSection() {
  return (
    <section id="preguntas" className="py-16 sm:py-20 lg:py-32 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 right-10 w-72 h-72 bg-secondary/5 rounded-full blur-3xl" />
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
            Preguntas frecuentes
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Todo lo que necesitás saber sobre GALTO
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card/50 backdrop-blur-sm border border-border rounded-lg px-6 data-[state=open]:border-primary/30"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="text-base sm:text-lg font-semibold text-foreground pr-4">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm sm:text-base text-muted-foreground pb-4 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground">
            ¿Tenés otra pregunta?{' '}
            <a href="#contacto" className="text-primary hover:underline font-medium">
              Hablemos
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
