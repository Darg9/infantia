import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anúnciate en HabitaPlan — Llega a familias en Bogotá',
  description:
    'Patrocina el newsletter de HabitaPlan o destaca tu academia en nuestra plataforma. Llega a familias que buscan actividades para sus hijos en Bogotá.',
};

const CONTACT_EMAIL = 'info@habitaplan.com';

const STATS = [
  { label: 'Actividades indexadas', value: '260+' },
  { label: 'Fuentes activas', value: '14' },
  { label: 'Ciudades cubiertas', value: '10' },
  { label: 'Tasa apertura email', value: '~35%' },
];

const OPTIONS = [
  {
    id: 'newsletter',
    badge: 'Disponible mes 6',
    title: 'Patrocinio de Newsletter',
    price: 'COP 200.000 – 500.000 / edición',
    description:
      'Tu marca aparece en el digest semanal que enviamos a familias suscritas. Incluye logo, tagline y enlace con UTM tracking para medir clicks reales.',
    items: [
      'Bloque destacado en el email semanal',
      'Logo + tagline + link a tu sitio',
      'UTM tracking — sabrás exactamente cuántos clicks recibiste',
      'Mención en redes sociales de HabitaPlan',
    ],
    cta: 'Reservar lugar en lista de espera',
    subject: 'Quiero patrocinar el newsletter de HabitaPlan',
  },
  {
    id: 'listing',
    badge: 'Disponible mes 9',
    title: 'Listing Destacado',
    price: 'COP 150.000 – 300.000 / mes',
    description:
      'Tus actividades aparecen primero en los resultados de búsqueda con un badge "Destacado" en color dorado. Máxima visibilidad para padres que buscan activamente.',
    items: [
      'Badge ⭐ Destacado en todas tus tarjetas',
      'Posición preferente en búsqueda y filtros',
      'Perfil de proveedor verificado y reclamado',
      'Métricas de vistas e interacciones',
    ],
    cta: 'Reservar mi lugar destacado',
    subject: 'Quiero un listing destacado en HabitaPlan',
  },
];

export default function AnunciatePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-700 to-indigo-500 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block rounded-full bg-white/20 px-4 py-1 text-sm font-semibold mb-4">
            Para academias, instituciones y marcas
          </span>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Llega a las familias que ya están buscando
          </h1>
          <p className="text-indigo-100 text-lg leading-relaxed">
            HabitaPlan es la plataforma donde las familias de Bogotá descubren actividades para sus
            hijos. Pon tu propuesta frente a ellas en el momento exacto.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-gray-200 py-10 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-indigo-700">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Opciones */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
          Elige cómo aparecer en HabitaPlan
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {OPTIONS.map((opt) => (
            <div
              key={opt.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col"
            >
              <span className="inline-block rounded-full bg-warning-100 text-warning-800 text-xs font-semibold px-3 py-1 mb-4 w-fit">
                {opt.badge}
              </span>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{opt.title}</h3>
              <p className="text-indigo-700 font-semibold text-sm mb-4">{opt.price}</p>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">{opt.description}</p>
              <ul className="space-y-2 mb-8 flex-1">
                {opt.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(opt.subject)}`}
                className="block text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 transition-colors"
              >
                {opt.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Contacto directo */}
      <section className="bg-indigo-50 border-t border-indigo-100 py-14 px-4 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">¿Tienes preguntas?</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Escríbenos directamente. Respondemos en menos de 24 horas.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quiero anunciarme en HabitaPlan')}`}
          className="inline-block rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 transition-colors"
        >
          Escribir a {CONTACT_EMAIL}
        </a>
      </section>
    </main>
  );
}
