import type { Metadata } from 'next';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Anúnciate en HabitaPlan — Llega a familias en Bogotá',
  description:
    'Patrocina el newsletter de HabitaPlan o destaca tu academia en nuestra plataforma. Llega a familias que buscan actividades para sus hijos en Bogotá.',
};

const CONTACT_EMAIL = 'info@habitaplan.com';

export default async function AnunciatePage() {
  const [totalActivities, activeSources, activeCities] = await Promise.all([
    prisma.activity.count({ where: { status: 'ACTIVE' } }),
    prisma.scrapingSource.count({ where: { isActive: true } }),
    prisma.city.count({ where: { isActive: true } }),
  ]);

  const stats = [
    { label: 'Actividades indexadas', value: `${totalActivities}+` },
    { label: 'Fuentes activas', value: activeSources.toString() },
    { label: 'Ciudades cubiertas', value: activeCities.toString() },
  ];

  return (
    <main className="min-h-screen bg-[var(--hp-bg-page)]">
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-700 to-indigo-500 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block rounded-full bg-white/20 px-4 py-1 text-sm font-semibold mb-4">
            Para academias, instituciones y marcas
          </span>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Llega a las familias que ya están buscando
          </h1>
          <p className="text-brand-100 text-lg leading-relaxed">
            HabitaPlan es la plataforma donde las familias de Bogotá descubren actividades para sus
            hijos. Pon tu propuesta frente a ellas en el momento exacto.
          </p>
        </div>
      </section>
      {/* Stats */}
      <section className="bg-[var(--hp-bg-surface)] border-b border-[var(--hp-border)] py-10 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-brand-700">{s.value}</p>
              <p className="text-sm text-[var(--hp-text-secondary)] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
      {/* Contacto directo */}
      <section className="bg-[var(--hp-bg-subtle)] border-t border-brand-100 py-14 px-4 text-center">
        <h2 className="text-xl font-bold text-[var(--hp-text-primary)] mb-2">¿Tienes preguntas?</h2>
        <p className='text-[var(--hp-text-secondary)] mb-6 max-w-md mx-auto'>
          Escríbenos directamente. Respondemos en menos de 24 horas.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quiero anunciarme en HabitaPlan')}`}
          className="inline-block rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-8 transition-colors"
        >
          Escribir a {CONTACT_EMAIL}
        </a>
      </section>
    </main>
  );
}
