// =============================================================================
// Home — Landing page de Infantia
// Deployed with deduplication system (2026-03-24)
// =============================================================================

import { listActivities } from '@/modules/activities';
import { prisma } from '@/lib/db';
import { getCategoryEmoji } from '@/lib/category-utils';

export default async function HomePage() {
  const [{ total }, categories] = await Promise.all([
    listActivities({ skip: 0, pageSize: 1 }),
    prisma.category.findMany({
      where: {
        activities: {
          some: {
            activity: { status: { in: ['ACTIVE', 'EXPIRED'] } },
          },
        },
      },
      include: {
        _count: { select: { activities: true } },
      },
      orderBy: { activities: { _count: 'desc' } },
      take: 8,
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-6">
          <span>🎉</span>
          <span>{total} actividades disponibles en Bogotá</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
          Descubre actividades{' '}
          <span className="text-indigo-600">para toda la familia</span>
        </h1>

        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
          Talleres, eventos, clubes y cursos para niños y jóvenes en Bogotá.
          Todo en un solo lugar, siempre actualizado.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/actividades"
            className="rounded-full bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Explorar actividades →
          </a>
          <a
            href="/actividades?search=gratis"
            className="rounded-full border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Solo gratuitas 🎁
          </a>
        </div>
      </section>

      {/* Categorías */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Explora por categoría
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/actividades?categoryId=${cat.id}`}
                className="flex flex-col items-center gap-2 rounded-2xl bg-white border border-gray-100 p-5 text-center hover:border-indigo-200 hover:shadow-sm transition-all group"
              >
                <span className="text-3xl">{getCategoryEmoji(cat.name)}</span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700 transition-colors">
                  {cat.name}
                </span>
              </a>
            ))}
          </div>
          <div className="text-center mt-6">
            <a href="/actividades" className="text-sm text-indigo-600 hover:underline font-medium">
              Ver todas las categorías →
            </a>
          </div>
        </section>
      )}

    </div>
  );
}
