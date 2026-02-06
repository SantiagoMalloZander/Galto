'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export function FAQSection() {
  const faqs = [
    {
      question: '¿Cómo funciona el período de prueba?',
      answer:
        'Tenés 14 días completamente gratis para probar GALTO. No necesitás tarjeta de crédito para empezar. Si te gusta, elegís un plan. Si no, no pasa nada.',
    },
    {
      question: '¿Mis clientes necesitan descargar una app?',
      answer:
        'No. Tus clientes reservan desde su navegador, sin descargar nada. Les mandás un link y listo. Es súper simple.',
    },
    {
      question: '¿Los recordatorios por WhatsApp tienen costo extra?',
      answer:
        'No. Los recordatorios automáticos están incluidos en ambos planes. Usamos WhatsApp Business API oficial.',
    },
    {
      question: '¿Puedo cancelar en cualquier momento?',
      answer:
        'Sí, sin compromiso. No hay permanencia. Cancelás cuando quieras desde tu panel de control, sin hablar con nadie.',
    },
    {
      question: '¿Qué pasa si supero el límite de reservas?',
      answer:
        'En el plan Starter, si superás las 200 reservas, te avisamos para que puedas pasar a Pro. No bloqueamos tu cuenta ni perdés datos.',
    },
    {
      question: '¿Necesito conocimientos técnicos?',
      answer:
        'Para nada. Si sabés usar WhatsApp e Instagram, podés usar GALTO. Es tan fácil como usar redes sociales.',
    },
    {
      question: '¿Puedo integrar GALTO con mis redes sociales?',
      answer:
        'Sí. Podés poner el link de reservas en tu bio de Instagram, en tu perfil de Facebook, en tus historias, o donde quieras.',
    },
    {
      question: '¿Qué métodos de pago aceptan?',
      answer:
        'Aceptamos tarjetas de crédito, débito y transferencias bancarias. También podés pagar por MercadoPago. Todo en pesos argentinos.',
    },
  ]

  return (
    <section className="py-24 md:py-32" id="faq">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-balance mb-4">
            {'Preguntas frecuentes'}
          </h2>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            {'¿Tenés alguna duda? Acá están las respuestas a las preguntas más comunes'}
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border rounded-xl px-6 data-[state=open]:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left hover:no-underline py-5">
                  <span className="font-semibold text-balance pr-4">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-pretty leading-relaxed pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            {'¿Tenés otra pregunta? '}
            <a
              href="https://wa.me/5491123401136"
              className="text-primary hover:underline font-medium"
            >
              {'Escribinos por WhatsApp'}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
