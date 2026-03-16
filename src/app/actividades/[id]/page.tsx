// =============================================================================
// /actividades/[id] — Página de detalle de una actividad
// Server Component: lee el ID, consulta DB, renderiza todos los datos
// =============================================================================

import { notFound } from 'next/navigation';
import { getActivityById } from '@/modules/activities';
import clsx from 'clsx';

const TYPE_LABELS: Record<string, string> = {
  RECURRING: 'Recurrente',
  ONE_TIME: 'Única vez',
  CAMP: 'Campamento',
  WORKSHOP: 'Taller',
};

const PERIOD_LABELS: Record<string, string> = {
  PER_SESSION: 'por sesión',
  MONTHLY: 'por mes',
  TOTAL: 'total',
  FREE: '',
};

// Colores por categoría (mismo hash que ActivityCard)
const CATEGORY_COLORS = [
  'bg-indigo-100',
  'bg-emerald-100',
  'bg-amber-100',
  'bg-rose-100',
  'bg-cyan-100',
  'bg-violet-100',
  'bg-orange-100',
  'bg-teal-100',
];

function getCategoryColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

function formatDate(dateStr: Date | string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatPrice(price: unknown, currency: string, period: string | null): string {
  if (price === null || price === undefined) return 'Consultar';
  const num = typeof price === 'number' ? price
    : typeof price === 'object' && price !== null && 'toNumber' in price
    ? (price as { toNumber(): number }).toNumber()
    : Number(price);
  if (num === 0 || period === 'FREE') return 'Gratis';
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(num);
  return period ? `${formatted} ${PERIOD_LABELS[period] ?? ''}`.trim() : formatted;
}

// Parsea el JSON de schedule que usa BibloRed
interface ScheduleItem {
  startDate?: string;
  endDate?: string;
  notes?: string;
}

function parseSchedule(schedule: unknown): ScheduleItem[] {
  if (!schedule || typeof schedule !== 'object') return [];
  const s = schedule as { items?: ScheduleItem[] };
  return s.items ?? [];
}

export default async function ActividadDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = await getActivityById(id);

  if (!activity) notFound();

  const mainCategory = activity.categories[0]?.category;
  const bgColor = mainCategory ? getCategoryColor(mainCategory.slug) : 'bg-indigo-100';
  const scheduleItems = parseSchedule(activity.schedule);
  const priceLabel = formatPrice(activity.price, activity.priceCurrency, activity.pricePeriod);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <span className="text-2xl font-bold text-indigo-700">Infantia</span>
          <a
            href="/actividades"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Volver a actividades
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6">

        {/* Hero: imagen o placeholder de color */}
        <div className={clsx('relative h-48 sm:h-64 rounded-2xl overflow-hidden flex items-center justify-center', bgColor)}>
          {activity.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activity.imageUrl}
              alt={activity.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-8xl select-none opacity-50">🎨</span>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
              {TYPE_LABELS[activity.type] ?? activity.type}
            </span>
            <span className={clsx(
              'rounded-full px-3 py-1 text-xs font-semibold shadow-sm',
              priceLabel === 'Gratis'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/90 text-gray-700'
            )}>
              {priceLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Columna principal */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Título y categorías */}
            <div className="flex flex-col gap-3">
              {activity.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activity.categories.map(({ category }) => (
                    <span
                      key={category.id}
                      className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                    >
                      {category.name}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="text-2xl font-bold text-gray-900 leading-snug">{activity.title}</h1>
            </div>

            {/* Descripción */}
            <div className="rounded-2xl bg-white border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Descripción</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{activity.description}</p>
            </div>

            {/* Fechas y horarios */}
            {(activity.startDate || scheduleItems.length > 0) && (
              <div className="rounded-2xl bg-white border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Fechas y horarios</h2>
                <div className="flex flex-col gap-2">
                  {activity.startDate && (
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-0.5">📅</span>
                      <span>
                        {formatDate(activity.startDate)}
                        {activity.endDate && activity.endDate.toString() !== activity.startDate.toString() && (
                          <> — {formatDate(activity.endDate)}</>
                        )}
                      </span>
                    </div>
                  )}
                  {scheduleItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-0.5">🕐</span>
                      <span>
                        {item.startDate && formatDate(item.startDate)}
                        {item.notes && <span className="text-gray-500"> · {item.notes}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proveedor */}
            {activity.provider && (
              <div className="rounded-2xl bg-white border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Organiza</h2>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-lg font-bold text-indigo-700">
                    {activity.provider.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-gray-900">{activity.provider.name}</span>
                      {activity.provider.isVerified && (
                        <span className="text-xs text-indigo-500 font-medium">✓ Verificado</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {({ ACADEMY: 'Academia', INDEPENDENT: 'Independiente', INSTITUTION: 'Institución', GOVERNMENT: 'Entidad pública' } as Record<string,string>)[activity.provider.type] ?? activity.provider.type}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Columna lateral */}
          <div className="flex flex-col gap-4">

            {/* Datos rápidos */}
            <div className="rounded-2xl bg-white border border-gray-100 p-5 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Detalles</h2>

              {/* Precio */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Precio</span>
                <span className={clsx(
                  'font-semibold',
                  priceLabel === 'Gratis' ? 'text-emerald-600' : 'text-gray-900'
                )}>{priceLabel}</span>
              </div>

              {/* Edad */}
              {(activity.ageMin !== null || activity.ageMax !== null) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Edad</span>
                  <span className="text-gray-900">
                    {activity.ageMin !== null && activity.ageMax !== null
                      ? `${activity.ageMin}–${activity.ageMax} años`
                      : activity.ageMin !== null
                      ? `Desde ${activity.ageMin} años`
                      : `Hasta ${activity.ageMax} años`}
                  </span>
                </div>
              )}

              {/* Capacidad */}
              {activity.capacity && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Capacidad</span>
                  <span className="text-gray-900">{activity.capacity} personas</span>
                </div>
              )}

              {/* Ubicación */}
              {activity.location && (
                <div className="flex flex-col gap-0.5 text-sm border-t border-gray-100 pt-3 mt-1">
                  <span className="text-gray-500">Ubicación</span>
                  <span className="text-gray-900 font-medium">{activity.location.name}</span>
                  {activity.location.address && (
                    <span className="text-gray-500 text-xs">{activity.location.address}</span>
                  )}
                  {activity.location.neighborhood && (
                    <span className="text-gray-400 text-xs">{activity.location.neighborhood}</span>
                  )}
                  {activity.location.city && (
                    <span className="text-gray-400 text-xs">{activity.location.city.name}</span>
                  )}
                </div>
              )}
            </div>

            {/* CTA — link al origen */}
            {activity.sourceUrl && (
              <a
                href={activity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                Ver en {activity.sourcePlatform === 'WEBSITE' ? 'sitio oficial' : activity.sourcePlatform ?? 'fuente original'}
                <span>↗</span>
              </a>
            )}

            {/* Confianza y fuente */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col gap-1.5 text-xs text-gray-400">
              <div className="flex items-center justify-between">
                <span>Fuente</span>
                <span className="text-gray-600 capitalize">{activity.sourcePlatform?.toLowerCase() ?? 'manual'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Confianza</span>
                <span className="text-gray-600">{Math.round(activity.sourceConfidence * 100)}%</span>
              </div>
              {activity.sourceCapturedAt && (
                <div className="flex items-center justify-between">
                  <span>Capturado</span>
                  <span className="text-gray-600">
                    {new Date(activity.sourceCapturedAt).toLocaleDateString('es-CO')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
