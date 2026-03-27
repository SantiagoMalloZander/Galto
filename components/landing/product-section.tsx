import { Bot, CalendarDays, MessagesSquare } from 'lucide-react'

const solutionBlocks = [
  {
    icon: CalendarDays,
    title: 'Detecta huecos de agenda',
    text: 'Galto identifica franjas con baja ocupacion y prioriza esas horas para reactivacion.',
    step: 'Paso 1',
  },
  {
    icon: Bot,
    title: 'Predice quien esta por volver',
    text: 'Analiza historial por servicio para anticipar el mejor momento de contacto.',
    step: 'Paso 2',
  },
  {
    icon: MessagesSquare,
    title: 'Recontacta con oferta personalizada',
    text: 'Envia mensajes con foco en convertir, no en tirar promos sin contexto.',
    step: 'Paso 3',
  },
]

export function ProductSection() {
  return (
    <section id="solucion" className="bg-[#FAF7F2] py-24 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-12">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <span className="inline-block rounded-full bg-[#E8634A]/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E8634A]">
            Solucion Galto
          </span>
          <h2 className="mt-6 text-balance text-4xl font-bold leading-tight text-[#1A1A1A] sm:text-5xl md:text-6xl">
            IA que llena tu agenda sola
          </h2>
          <p className="mt-5 text-lg text-[#1A1A1A]/50 md:text-xl">
            Vos seguis atendiendo. Galto trabaja por atras para que tus horarios no queden vacios.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {solutionBlocks.map((item) => (
            <article
              key={item.title}
              className="group rounded-[2rem] bg-white p-8 shadow-[0_2px_40px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_8px_50px_rgba(0,0,0,0.08)]"
            >
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#E8634A]">{item.step}</span>
              <div className="mt-5 inline-flex rounded-2xl bg-[#FAF7F2] p-4 text-[#E8634A] transition-colors group-hover:bg-[#E8634A]/10">
                <item.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-[#1A1A1A]">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#1A1A1A]/50">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
