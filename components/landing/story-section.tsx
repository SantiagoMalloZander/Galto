import { Users, CalendarX2, MessageSquareOff } from 'lucide-react'

const painPoints = [
  {
    icon: Users,
    title: 'El cliente no vuelve',
    text: 'Sin seguimiento real, el cliente se enfria y termina agendando en otro lado.',
    number: '01',
  },
  {
    icon: CalendarX2,
    title: 'Agenda con huecos',
    text: 'Si tenes horarios vacios, estas perdiendo plata todos los dias.',
    number: '02',
  },
  {
    icon: MessageSquareOff,
    title: 'Todo cae en WhatsApp manual',
    text: 'Responder, confirmar y recordar a mano te consume tiempo y energia.',
    number: '03',
  },
]

export function StorySection() {
  return (
    <section id="problema" className="bg-[#1A1A1A] py-24 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E8634A]">
            Problema real
          </span>
          <h2 className="mt-6 text-balance text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
            Mas del 50% de tus clientes no vuelve.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/50 md:text-xl">
            No es por calidad. Es por falta de sistema. Si nadie los recontacta a tiempo, se pierden reservas y facturacion.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {painPoints.map((item) => (
            <article
              key={item.title}
              className="group rounded-[2rem] border border-white/8 bg-white/5 p-8 transition-all hover:border-[#E8634A]/30 hover:bg-white/8"
            >
              <span className="text-sm font-bold text-[#E8634A]">{item.number}</span>
              <div className="mt-4 inline-flex rounded-2xl bg-white/10 p-3 text-white">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/50">{item.text}</p>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl rounded-[2rem] border border-[#E8634A]/20 bg-[#E8634A]/8 p-6 text-center md:p-8">
          <p className="text-sm font-semibold text-[#E8634A]">Impacto directo</p>
          <p className="mt-2 text-base text-white/70">
            Cada hueco vacio es dinero que no vuelve. Cada cliente perdido es facturacion futura que desaparece.
          </p>
        </div>
      </div>
    </section>
  )
}
