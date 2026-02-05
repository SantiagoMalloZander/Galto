export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-foreground/5 border-t border-border py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">G</span>
              </div>
              <div>
                <span className="font-bold text-lg text-foreground">GALTO</span>
                <p className="text-[10px] text-muted-foreground -mt-1">by MZ Consulting</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Sistema de gestión y crecimiento para barberías y peluquerías.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Producto</h3>
            <ul className="space-y-2">
              <li>
                <a href="#producto" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#precios" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Precios
                </a>
              </li>
              <li>
                <a href="#resultados" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Resultados
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Empresa</h3>
            <ul className="space-y-2">
              <li>
                <a href="#enfoque" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Enfoque
                </a>
              </li>
              <li>
                <a href="#preguntas" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Preguntas frecuentes
                </a>
              </li>
              <li>
                <a href="#contacto" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Contacto</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://wa.me/5491123401136"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="mailto:mzanderconsulting@gmail.com"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Email
                </a>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">Buenos Aires, Argentina</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} GALTO by MZ Consulting. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Términos
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacidad
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
