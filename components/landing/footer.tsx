import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="border-t border-[#F0ECE4] bg-[#FAF7F2]">
      <div className="mx-auto w-full max-w-7xl px-5 py-12 lg:px-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#E8E2D9] bg-white">
              <Image src="/logogalto.png" alt="GALTO" width={40} height={40} className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-base font-semibold text-[#1A1A1A]">GALTO</p>
              <p className="text-xs text-[#1A1A1A]/40">No perdes clientes nunca mas</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-[#1A1A1A]/50">
            <a href="#problema" className="transition-colors hover:text-[#E8634A]">Problema</a>
            <a href="#solucion" className="transition-colors hover:text-[#E8634A]">Solucion</a>
            <a href="#beneficios" className="transition-colors hover:text-[#E8634A]">Beneficios</a>
            <a href="#demo" className="transition-colors hover:text-[#E8634A]">Demo</a>
            <a href="#precios" className="transition-colors hover:text-[#E8634A]">Precios</a>
            <Link href="/login" className="transition-colors hover:text-[#E8634A]">Entrar</Link>
          </div>
        </div>

        <div className="mt-10 border-t border-[#F0ECE4] pt-6">
          <p className="text-xs text-[#1A1A1A]/30">
            {new Date().getFullYear()} Galto. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
