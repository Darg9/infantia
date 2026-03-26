// =============================================================================
// SimilarActivities — Sección "Actividades similares" en el detalle
// Server Component: carga datos y renderiza tarjetas compactas
// =============================================================================

import Link from 'next/link';
import { getSimilarActivities } from '@/modules/activities';
import { activityPath } from '@/lib/activity-url';
import { getCategoryEmoji } from '@/lib/category-utils';

interface Props {
  activityId: string;
}

export async function SimilarActivities({ activityId }: Props) {
  const similar = await getSimilarActivities(activityId, 4);

  if (similar.length === 0) return null;

  return (
    <section className="col-span-full mt-2">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Actividades similares</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {similar.map((act) => {
          const emoji = getCategoryEmoji(act.categories[0]?.category.slug ?? '');
          const priceNum = act.price !== null ? Number(act.price) : null;
          const priceLabel =
            priceNum === null
              ? null
              : priceNum === 0
                ? 'Gratis'
                : `$${priceNum.toLocaleString('es-CO')}`;

          return (
            <Link
              key={act.id}
              href={activityPath(act.id, act.title)}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm transition-all overflow-hidden"
            >
              {/* Imagen o emoji */}
              <div className="relative h-28 bg-gray-50 shrink-0 overflow-hidden">
                {act.imageUrl ? (
                  <img
                    src={act.imageUrl}
                    alt={act.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl opacity-40">{emoji}</span>
                  </div>
                )}
                {priceLabel && (
                  <span
                    className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      priceLabel === 'Gratis'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {priceLabel}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3 flex flex-col gap-1 flex-1">
                <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-orange-600 transition-colors leading-tight">
                  {act.title}
                </p>
                {act.location && (
                  <p className="text-xs text-gray-400 truncate">
                    {act.location.neighborhood ?? act.location.city.name}
                  </p>
                )}
                {act.categories[0] && (
                  <span className="mt-auto inline-block text-xs text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5 w-fit">
                    {act.categories[0].category.name}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
