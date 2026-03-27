'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#FAF7F2] px-5 pt-20 lg:px-12">
      {/* Decorative shapes */}
      <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#E8634A]/8" />
        <div className="absolute -left-20 bottom-20 h-[400px] w-[400px] rounded-full bg-[#E8634A]/5" />
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#F0E6D8]/60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 mx-auto max-w-5xl text-center"
      >
        <span className="inline-block rounded-full bg-[#E8634A]/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E8634A]">
          Nuevo enfoque de crecimiento
        </span>

        <h1 className="mt-8 text-balance text-5xl font-bold leading-[1.08] tracking-tight text-[#1A1A1A] sm:text-6xl md:text-7xl lg:text-8xl">
          El sistema que
          <br />
          <span className="text-[#E8634A]">te llena la agenda</span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-[#1A1A1A]/60 md:text-xl">
          Galto trabaja incluso cuando vos no: recontacta clientes, predice demanda y ocupa horarios vacios.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/login?plan=DEMO"
            className="group inline-flex items-center gap-2 rounded-full bg-[#E8634A] px-8 py-4 text-base font-semibold text-white transition-all hover:bg-[#D4532E] hover:shadow-[0_16px_40px_rgba(232,99,74,0.3)]"
          >
            Obtener Galto gratis
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-full border-2 border-[#1A1A1A]/12 px-8 py-4 text-base font-semibold text-[#1A1A1A] transition-all hover:border-[#1A1A1A]/25 hover:bg-white"
          >
            Iniciar sesion
          </Link>
        </div>
      </motion.div>

      {/* Dashboard preview card */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
        className="relative z-10 mx-auto mt-16 w-full max-w-4xl pb-16 lg:mt-20"
      >
        <div className="rounded-[2rem] bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.08)] md:p-8">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#E8634A]" />
            <span className="h-3 w-3 rounded-full bg-[#F4A261]" />
            <span className="h-3 w-3 rounded-full bg-[#4CAF79]" />
            <span className="ml-3 text-xs font-medium text-[#1A1A1A]/40">Tablero Galto</span>
          </div>
          <div className="rounded-2xl border border-[#F0ECE4] bg-[#FDFCFA] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">Sucursal central</p>
                <p className="text-xs text-[#1A1A1A]/40">Hoy, en tiempo real</p>
              </div>
              <span className="rounded-full bg-[#4CAF79]/10 px-3 py-1 text-xs font-semibold text-[#4CAF79]">En vivo</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#F0ECE4] bg-white p-4">
                <p className="text-xs font-medium text-[#1A1A1A]/50">Reservas hoy</p>
                <p className="mt-1 text-3xl font-bold text-[#1A1A1A]">31</p>
              </div>
              <div className="rounded-2xl border border-[#F0ECE4] bg-white p-4">
                <p className="text-xs font-medium text-[#1A1A1A]/50">Confirmadas</p>
                <p className="mt-1 text-3xl font-bold text-[#1A1A1A]">87%</p>
              </div>
              <div className="rounded-2xl border border-[#F0ECE4] bg-white p-4">
                <p className="text-xs font-medium text-[#1A1A1A]/50">Ingresos del mes</p>
                <p className="mt-1 text-3xl font-bold text-[#4CAF79]">+22%</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-[#E8634A]/8 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#E8634A]">Accion IA</p>
              <p className="mt-1 text-sm font-medium text-[#1A1A1A]">
                Campana lista para recuperar 14 clientes de &quot;Corte + Barba&quot; hoy a las 18:00.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
