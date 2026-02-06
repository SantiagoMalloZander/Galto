import Link from 'next/link'
import { Instagram, Linkedin, Mail, MessageCircle } from 'lucide-react'

export function Footer() {
  const navigation = {
    producto: [
      { name: 'Funcionalidades', href: '#producto' },
      { name: 'Precios', href: '#precios' },
      { name: 'FAQ', href: '#faq' },
    ],
    empresa: [
      { name: 'Sobre nosotros', href: '#' },
      { name: 'Contacto', href: 'mailto:mzanderconsulting@gmail.com' },
    ],
    legal: [
      { name: 'Términos y condiciones', href: '#' },
      { name: 'Política de privacidad', href: '#' },
    ],
  }

  return (
    <footer className="bg-muted/50 border-t border-border">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Main Footer */}
        <div className="py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-display font-bold text-xl">
                  {'G'}
                </span>
              </div>
              <span className="font-display font-bold text-2xl">{'GALTO'}</span>
            </Link>
            <p className="text-sm text-muted-foreground text-pretty mb-4">
              {'Más reservas. Cero huecos. El sistema para barberías y peluquerías que quieren crecer.'}
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/5491123401136"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-primary/10 hover:bg-primary flex items-center justify-center group transition-colors"
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-4 h-4 text-primary group-hover:text-primary-foreground transition-colors" />
              </a>
              <a
                href="https://instagram.com/galto.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-primary/10 hover:bg-primary flex items-center justify-center group transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4 text-primary group-hover:text-primary-foreground transition-colors" />
              </a>
              <a
                href="https://linkedin.com/company/mz-consulting"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-primary/10 hover:bg-primary flex items-center justify-center group transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4 text-primary group-hover:text-primary-foreground transition-colors" />
              </a>
              <a
                href="mailto:mzanderconsulting@gmail.com"
                className="w-9 h-9 rounded-lg bg-primary/10 hover:bg-primary flex items-center justify-center group transition-colors"
                aria-label="Email"
              >
                <Mail className="w-4 h-4 text-primary group-hover:text-primary-foreground transition-colors" />
              </a>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h3 className="font-semibold mb-4">{'Producto'}</h3>
            <ul className="space-y-3">
              {navigation.producto.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h3 className="font-semibold mb-4">{'Empresa'}</h3>
            <ul className="space-y-3">
              {navigation.empresa.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">{'Legal'}</h3>
            <ul className="space-y-3">
              {navigation.legal.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {'© 2025 GALTO by MZ Consulting. Todos los derechos reservados.'}
          </p>
          <p className="text-sm text-muted-foreground">
            {'Hecho con ❤️ en Buenos Aires'}
          </p>
        </div>
      </div>
    </footer>
  )
}
