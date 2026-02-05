'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: '#enfoque', label: 'Enfoque' },
    { href: '#producto', label: 'Producto' },
    { href: '#resultados', label: 'Resultados' },
    { href: '#precios', label: 'Precios' },
    { href: '#preguntas', label: 'Preguntas' },
    { href: '#contacto', label: 'Contacto' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg sm:text-xl">G</span>
              </div>
              <div>
                <span className="font-bold text-lg sm:text-xl text-foreground tracking-tight">GALTO</span>
                <p className="text-[10px] sm:text-xs text-muted-foreground -mt-1">by MZ Consulting</p>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Button variant="outline" asChild className="bg-transparent">
              <a href="https://wa.me/5491123401136" target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </Button>
            <Button asChild className="bg-primary text-primary-foreground">
              <a href="#contacto">Agendar demo</a>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-background border-t border-border">
          <div className="container mx-auto px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 space-y-2">
              <Button variant="outline" className="w-full bg-transparent" asChild>
                <a href="https://wa.me/5491123401136" target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </Button>
              <Button className="w-full bg-primary text-primary-foreground" asChild>
                <a href="#contacto">Agendar demo</a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
