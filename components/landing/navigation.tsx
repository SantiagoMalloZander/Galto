'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '#problema', label: 'Problema' },
  { href: '#solucion', label: 'Soluciones' },
  { href: '#demo', label: 'IA' },
  { href: '#precios', label: 'Precios' },
  { href: '#faq', label: 'FAQ' },
]

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        isScrolled || isMobileMenuOpen
          ? 'bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center justify-between px-5 lg:px-12">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#E8E2D9] bg-white">
            <Image src="/logogalto.png" alt="GALTO" width={40} height={40} className="h-full w-full object-contain" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-[#1A1A1A]">GALTO</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#1A1A1A]/60 transition-colors hover:text-[#1A1A1A]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-full px-5 py-2.5 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A]/5"
          >
            Iniciar sesion
          </Link>
          <Link
            href="/login?plan=DEMO"
            className="rounded-full bg-[#E8634A] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#D4532E] hover:shadow-[0_8px_24px_rgba(232,99,74,0.3)]"
          >
            Empezar gratis
          </Link>
        </div>

        <button
          type="button"
          aria-label="Abrir menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E8E2D9] bg-white text-[#1A1A1A] md:hidden"
          onClick={() => setIsMobileMenuOpen((v) => !v)}
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isMobileMenuOpen ? (
        <div className="border-t border-[#E8E2D9] bg-white md:hidden">
          <div className="mx-auto w-full max-w-7xl space-y-1 px-5 py-5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block rounded-2xl px-4 py-3 text-sm font-medium text-[#1A1A1A] hover:bg-[#FAF7F2]"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-full border border-[#E8E2D9] px-4 py-3 text-center text-sm font-medium text-[#1A1A1A]"
              >
                Iniciar sesion
              </Link>
              <Link
                href="/login?plan=DEMO"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-full bg-[#E8634A] px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Empezar gratis
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  )
}
