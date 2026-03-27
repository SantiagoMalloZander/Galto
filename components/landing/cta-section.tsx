import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-[#1A1A1A] py-24 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-4xl px-5 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
            Si hoy tenes huecos, hoy estas perdiendo plata.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/50 md:text-xl">
            Activa Galto y empeza a recuperar clientes desde esta semana.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/login?plan=DEMO"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#E8634A] px-8 py-4 text-base font-semibold text-white transition-all hover:bg-[#D4532E] hover:shadow-[0_16px_40px_rgba(232,99,74,0.3)]"
            >
              Probar gratis
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://wa.me/5491123401136"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/15 px-8 py-4 text-base font-semibold text-white transition-all hover:border-white/30 hover:bg-white/5"
            >
              <MessageCircle size={18} />
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
