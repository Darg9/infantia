'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// =============================================================================
// SeguridadLayout — layout compartido para sub-rutas del Centro de Seguridad
// En /seguridad exacto → pasa-through (la página tiene su propio diseño)
// En /seguridad/privacidad, /seguridad/terminos, /seguridad/datos → tabs + header
// =============================================================================

const NAV_LINKS = [
  { href: '/seguridad/privacidad', label: 'Privacidad' },
  { href: '/seguridad/terminos',   label: 'Términos'   },
  { href: '/seguridad/datos',      label: 'Datos'      },
] as const;

export default function SeguridadLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // La página principal /seguridad tiene su propio diseño standalone (dark mode)
  // El layout solo actúa como wrapper en las sub-rutas de documentos legales
  if (pathname === '/seguridad') {
    return <>{children}</>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">

      {/* ── Volver al Centro de Seguridad ──────────────────────────── */}
      <Link
        href="/seguridad"
        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 mb-8 transition-colors"
      >
        ← Centro de Seguridad
      </Link>

      {/* ── Label superior ─────────────────────────────────────────── */}
      <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-2">
        Legal
      </p>

      {/* ── Título ─────────────────────────────────────────────────── */}
      <h1 className="text-3xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        🛡️ Centro de Seguridad
      </h1>

      {/* ── Navegación interna con tab activo ──────────────────────── */}
      <nav className="flex gap-1 mb-10 border-b border-gray-200">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300',
              ].join(' ')}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Contenido de cada sub-ruta ─────────────────────────────── */}
      <div className="prose max-w-none text-gray-600 leading-relaxed">
        {children}
      </div>

    </div>
  );
}
