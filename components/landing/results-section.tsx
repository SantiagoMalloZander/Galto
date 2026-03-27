import { CircleDollarSign, Clock3, UserRoundPlus } from 'lucide-react'

const benefits = [
  {
    icon: UserRoundPlus,
    title: 'Mas clientes',
    text: 'Volves a activar clientes que se estaban perdiendo.',
    metric: '+ reservas en horarios flojos',
  },
  {
    icon: CircleDollarSign,
    title: 'Mas ingresos',
    text: 'Tu agenda con menos huecos = mas facturacion mensual.',
    metric: 'Enfoque directo en rentabilidad',
  },
  {
    icon: Clock3,
    title: 'Menos trabajo manual',
    text: 'Menos tiempo en chats repetidos y mas foco en atender.',
    metric: 'Operacion simple tipo WhatsApp',
  },
]

export function ResultsSection() {
  return (
    <section id="beneficios" className="bg-white py-24 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-12">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="text-balance text-4xl font-bold leading-tight text-[#1A1A1A] sm:text-5xl md:text-6xl">
            Beneficios que impactan en caja
          </h2>
          <p className="mt-5 text-lg text-[#1A1A1A]/50 md:text-xl">
            Menos perdida de clientes, mas turnos confirmados y una operacion mas liviana.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map((benefit) => (
            <article
              key={benefit.title}
              className="group rounded-[2rem] border border-[#F0ECE4] bg-[#FDFCFA] p-8 transition-all hover:border-[#E8634A]/20 hover:bg-white hover:shadow-[0_8px_50px_rgba(0,0,0,0.06)]"
            >
              <div className="inline-flex rounded-2xl bg-[#E8634A]/8 p-4 text-[#E8634A]">
                <benefit.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-[#1A1A1A]">{benefit.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#1A1A1A]/50">{benefit.text}</p>
              <div className="mt-6 rounded-full bg-[#FAF7F2] px-4 py-2 text-xs font-semibold text-[#E8634A]">
                {benefit.metric}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
