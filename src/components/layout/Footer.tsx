import Link from 'next/link'
import Image from 'next/image'
import { SmartLink } from '@/components/ui/smart-link'

// =============================================================================
// Footer — estructura de 4 columnas + barra inferior
// =============================================================================

const NAV_COLUMNS = [
  {
    title: 'Explorar',
    links: [
      { label: 'Ver actividades',    href: '/actividades' },
      // { label: 'Categorías',         href: '/#categorias' }, // TODO: Revivir cuando exista /categorias dedicado
      { label: 'Publicar actividad', href: '/anunciate'   },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { label: 'Cómo funciona',        href: '/contribuir' },
      { label: 'Contacto',             href: '/contacto'   },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Centro de Confianza',              href: '/centro-de-confianza'       },
      { label: 'Términos de uso',                  href: '/terminos'                  },
      { label: 'Política de privacidad',           href: '/privacidad'                },
      { label: 'Política de tratamiento de datos', href: '/centro-de-confianza/datos' },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer aria-label="Pie de página" className="bg-[var(--hp-bg-surface)] border-t border-[var(--hp-border)] mt-auto">
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-10">

        {/* ── Grid de columnas ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">

          {/* Columna 1 — Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" aria-label="HabitaPlan — Inicio" className="block w-[120px] h-8 relative">
              <Image 
                src="/logo.svg" 
                alt="HabitaPlan Logo" 
                fill
                className="object-contain opacity-90 hover:opacity-100 transition-opacity dark:hidden"
              />
              <Image 
                src="/logo-dark.svg" 
                alt="HabitaPlan Logo" 
                fill
                className="object-contain opacity-90 hover:opacity-100 transition-opacity hidden dark:block"
              />
            </Link>
            <p className="text-sm text-[var(--hp-text-secondary)] mt-2 leading-relaxed max-w-xs">
              Encuentra actividades para disfrutar en familia
            </p>
          </div>

          {/* Columnas 2-4 — Navegación */}
          {NAV_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-[var(--hp-text-primary)] mb-4">
                {col.title}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <SmartLink
                      href={link.href}
                      className="text-sm text-[var(--hp-text-muted)] hover:text-[var(--hp-text-primary)] transition-colors"
                    >
                      {link.label}
                    </SmartLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Barra inferior ───────────────────────────────────────── */}
        <div className="border-t border-[var(--hp-border)] mt-8 pt-4 text-xs text-[var(--hp-text-muted)] text-center">
          Bogotá, Colombia · © {new Date().getFullYear()} HabitaPlan
        </div>

      </div>
    </footer>
  )
}
