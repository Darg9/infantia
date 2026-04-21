import type { Metadata } from 'next';
import Link from 'next/link';

// =============================================================================
// /seguridad — Centro de Seguridad HabitaPlan
// Legalmente coherente con Ley 1581 de 2012 (Colombia)
// Diseño: dark standalone (el layout.tsx pasa-through en esta ruta exacta)
// =============================================================================

export const metadata: Metadata = {
  title: 'Centro de Seguridad | HabitaPlan',
  description:
    'Centro de Seguridad de HabitaPlan. Protección de datos, transparencia, infraestructura segura y mecanismos de autorización parental para menores.',
};

// ── Data ─────────────────────────────────────────────────────────────────────

const CARDS = [
  {
    icon: '🔒',
    title: 'Protección de Datos',
    subtitle: 'Ley 1581 de 2012',
    items: [
      'Recolección de datos con consentimiento previo, expreso e informado',
      'Control del usuario sobre su información personal',
      'Cumplimiento de la normativa colombiana de protección de datos',
    ],
  },
  {
    icon: '👁️',
    title: 'Transparencia',
    subtitle: 'Uso responsable de la información',
    items: [
      'La información y las imágenes presentadas tienen fines informativos',
      'La información puede no reflejar cambios recientes realizados por el proveedor',
      'No garantizamos la disponibilidad, veracidad o condiciones de servicios de terceros',
      'Las imágenes pueden provenir de terceros; se respetan sus derechos de autor',
    ],
  },
  {
    icon: '🏗️',
    title: 'Plataforma Segura',
    subtitle: 'Infraestructura confiable',
    items: [
      'Uso de proveedores seguros (Vercel, Supabase)',
      'Comunicaciones cifradas mediante HTTPS',
      'Acceso restringido y controlado a la información',
    ],
  },
  {
    icon: '👨‍👩‍👧',
    title: 'Protección de Menores',
    subtitle: 'Autorización parental',
    items: [
      'El registro de menores de edad requiere autorización previa del padre o tutor',
      'Se implementan mecanismos de verificación y registro del consentimiento',
      'El uso de la cuenta del menor está condicionado a dicha autorización',
    ],
  },
] as const;

const LEGAL_LINKS = [
  { href: '/seguridad/privacidad', label: 'Privacidad'           },
  { href: '/seguridad/terminos',   label: 'Términos'             },
  { href: '/seguridad/datos',      label: 'Tratamiento de datos' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function SeguridadPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Gradiente de fondo sutil ─────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(249,115,22,0.10),transparent)]"
      />

      {/* ── Nav superior ─────────────────────────────────────────── */}
      <nav className="relative z-10 mx-auto max-w-5xl px-6 pt-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-[var(--hp-text-secondary)] hover:text-white transition-colors flex items-center gap-1.5"
        >
          ← Volver a HabitaPlan
        </Link>
        <span className="text-xs text-gray-600 hidden sm:block tracking-widest uppercase">
          Centro de Seguridad
        </span>
      </nav>

      {/* ── Contenido principal ───────────────────────────────────── */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* ── Header ───────────────────────────────────────────────── */}
        <header>
          <p className="text-sm text-brand-400/80 uppercase tracking-widest font-medium">
            Legal
          </p>

          <h1 className="text-4xl font-semibold mt-3 mb-5 flex items-center gap-3 text-white">
            🛡️ Centro de Seguridad
          </h1>

          <p className="text-[var(--hp-text-muted)] max-w-2xl leading-relaxed">
            Trabajamos para ofrecer una experiencia transparente y segura, basada en buenas
            prácticas y uso responsable de la información.
          </p>
          <p className="text-[var(--hp-text-muted)] max-w-2xl leading-relaxed mt-3">
            HabitaPlan implementa medidas de protección de datos alineadas con la normativa
            colombiana y buenas prácticas internacionales, incluyendo mecanismos de
            autorización parental para el registro de menores.
          </p>
        </header>

        {/* ── Grid de tarjetas ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          {CARDS.map(({ icon, title, subtitle, items }) => (
            <div
              key={title}
              className="rounded-2xl border border-gray-800 p-6 bg-black/40
                         hover:border-gray-700 hover:bg-black/60
                         transition-all duration-200"
            >
              {/* Icono + título */}
              <div className="flex items-start gap-3 mb-1">
                <span className="text-2xl mt-0.5">{icon}</span>
                <h3 className="text-xl font-semibold text-white">{title}</h3>
              </div>

              {/* Subtítulo */}
              <p className="text-sm text-[var(--hp-text-secondary)] ml-9 mb-5">{subtitle}</p>

              {/* Lista */}
              <ul className="space-y-2.5 text-sm text-[var(--hp-text-muted)]">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-brand-500/70 shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Separador ────────────────────────────────────────────── */}
        <div className="mt-14 border-t border-gray-800" />

        {/* ── Navegación a documentos legales ─────────────────────── */}
        <div className="mt-10">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-5">
            Documentos legales
          </p>
          <div className="flex flex-wrap gap-6 text-sm">
            {LEGAL_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-[var(--hp-text-muted)] hover:text-brand-400 transition-colors"
              >
                {label} →
              </Link>
            ))}
          </div>
        </div>

        {/* ── Footer interno ───────────────────────────────────────── */}
        <div className="mt-16 pt-6 border-t border-gray-800/50 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
          <p className="text-xs text-[var(--hp-text-primary)]">
            © {new Date().getFullYear()} HabitaPlan · Bogotá, Colombia
          </p>
          <p className="text-xs text-[var(--hp-text-primary)]">
            Normativa aplicable: Ley 1581 de 2012 · Decreto 1377 de 2013
          </p>
        </div>

      </main>
    </div>
  );
}
