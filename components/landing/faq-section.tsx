'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const faqs = [
  {
    question: 'Galto es solo una agenda?',
    answer:
      'No. La agenda es una parte. El foco de Galto es evitar perdida de clientes y recuperar reservas automaticamente.',
  },
  {
    question: 'Que incluye el plan gratis?',
    answer:
      'Incluye una sucursal con agenda online, calendario, clientes y centro de cuentas. Sin vencimiento.',
  },
  {
    question: 'Mis clientes tienen que descargar algo?',
    answer:
      'No. Reservan desde un link web, directo desde su celular.',
  },
  {
    question: 'Sirve para barberias, peluquerias y centros de estetica?',
    answer:
      'Si. Esta pensado para negocios de turnos donde cada hueco vacio impacta en ingresos.',
  },
  {
    question: 'Puedo empezar hoy y configurar rapido?',
    answer:
      'Si. La configuracion inicial es simple y esta guiada paso a paso dentro de la app.',
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="bg-[#FAF7F2] py-24 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-3xl px-5 lg:px-12">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold text-[#1A1A1A] sm:text-5xl">Preguntas frecuentes</h2>
          <p className="mt-4 text-lg text-[#1A1A1A]/50">Todo lo importante, claro y sin vueltas.</p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.question}
              value={`item-${index}`}
              className="rounded-2xl border border-[#F0ECE4] bg-white px-6 shadow-none transition-all data-[state=open]:shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
            >
              <AccordionTrigger className="py-5 text-left text-base font-semibold text-[#1A1A1A] hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-[#1A1A1A]/50">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
