import { Calendar, Bell, Users, LineChart } from 'lucide-react'

export function ProductSection() {
  const features = [
    {
      icon: Calendar,
      title: 'Sistema de turnos online',
      description:
        'Tu página de reservas personalizada. Los clientes eligen servicio, barbero y horario en segundos.',
    },
    {
      icon: Bell,
      title: 'Recordatorios automáticos',
      description:
        'WhatsApp automático 24hs antes del turno. Reducí ausencias hasta un 70% sin mover un dedo.',
    },
    {
      icon: Users,
      title: 'Reactivación de clientes',
      description:
        'Detectá clientes inactivos y enviales ofertas automáticas. Recuperá ventas perdidas fácil.',
    },
    {
      icon: LineChart,
      title: 'Métricas en tiempo real',
      description:
        'Dashboards claros: cuánto facturaste, quiénes son tus mejores clientes, qué servicios venden más.',
    },
  ]

  return (
    <section className="py-24 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-balance mb-4">
            {'Todo lo que necesitás en un solo lugar'}
          </h2>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            {'Diseñado específicamente para barberías y peluquerías en Argentina'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-card rounded-2xl p-6 border border-border hover:shadow-lg hover:border-primary/50 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <feature.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-balance">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground text-pretty leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
