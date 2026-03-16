// =============================================================================
// Home — Landing page de Infantia
// =============================================================================

import { listActivities } from '@/modules/activities';
import { prisma } from '@/lib/db';

const CATEGORY_EMOJIS: Record<string, string> = {
  'arte': '🎨', 'pintura': '🖌️', 'dibujo': '✏️',
  'música': '🎵', 'piano': '🎹', 'guitarra': '🎸', 'canto': '🎤',
  'deporte': '⚽', 'fútbol': '⚽', 'natación': '🏊', 'tenis': '🎾',
  'teatro': '🎭', 'actuación': '🎭',
  'danza': '💃', 'ballet': '🩰', 'baile': '💃',
  'ciencia': '🔬', 'experimento': '🔬',
  'lectura': '📚', 'libro': '📚',
  'tecnología': '💻', 'programación': '💻', 'robótica': '🤖',
  'cocina': '👨‍🍳', 'repostería': '🍰',
  'naturaleza': '🌿', 'ecología': '🌱',
  'yoga': '🧘', 'bienestar': '💆',
  'manualidad': '✂️',
  'cine': '🎬', 'audiovisual': '🎬',
  'lúdico': '🎮', 'juego': '🎲',
  'campamento': '⛺',
  'idioma': '🌍', 'inglés': '🌍', 'francés': '🌍',
  'matemática': '🔢', 'ajedrez': '♟️',
};

function getCategoryEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return '✨';
}

export default async function HomePage() {
  const [{ total }, categories] = await Promise.all([
    listActivities({ skip: 0, pageSize: 1 }),
    prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      take: 8,
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <span className="text-2xl font-bold text-indigo-700">Infantia</span>
          <a
            href="/actividades"
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Ver actividades
          </a>
        </div>
      </header>

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

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 flex items-center justify-between text-sm text-gray-400">
          <span className="font-bold text-indigo-700">Infantia</span>
          <span>Bogotá, Colombia · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
