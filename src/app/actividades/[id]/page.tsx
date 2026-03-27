// =============================================================================
// /actividades/[id] — Página de detalle de una actividad
// Server Component: lee el ID, consulta DB, renderiza todos los datos
// =============================================================================

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getActivityById } from '@/modules/activities';
import { ShareButton } from '@/components/ShareButton';
import { FavoriteButton } from '@/components/FavoriteButton';
import { RatingForm } from '@/components/RatingForm';
import { StarRating } from '@/components/StarRating';
import { ActivityHistoryTracker } from '@/components/profile/ActivityHistoryTracker';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractActivityId, activityPath } from '@/lib/activity-url';
import { SimilarActivities } from '@/components/SimilarActivities';
import clsx from 'clsx';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = extractActivityId(rawId);
  const activity = await getActivityById(id);
  if (!activity) return {};

  const title = activity.title;
  const description =
    activity.description?.slice(0, 160).replace(/\s+/g, ' ').trim() ??
    `${activity.title} — actividad en ${activity.location?.city?.name ?? 'Colombia'}`;
  const categoryNames = activity.categories
    .map((c) => c.category.name)
    .join(', ');
  const cityName = activity.location?.city?.name ?? 'Colombia';

  return {
    title,
    description,
    keywords: categoryNames ? [categoryNames, cityName, 'actividades'] : undefined,
    openGraph: {
      title: `${title} | Infantia`,
      description,
      type: 'article',
      ...(activity.imageUrl && { images: [{ url: activity.imageUrl }] }),
    },
    twitter: {
      card: activity.imageUrl ? 'summary_large_image' : 'summary',
      title: `${title} | Infantia`,
      description,
    },
    alternates: {
      canonical: activityPath(id, activity.title),
    },
  };
}

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

import { getCategoryGradient, getCategoryEmoji } from '@/lib/category-utils';

function formatDate(dateStr: Date | string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatPrice(price: unknown, currency: string, period: string | null): string {
  if (price === null || price === undefined) return 'No disponible';
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
  const { id: rawId } = await params;
  const id = extractActivityId(rawId);

  // Redirect a URL canónica si se accedió con UUID bare (sin slug de título)
  // Esto normaliza URLs antiguas y mejora SEO al unificar la canonical
  const [activity, sessionUser] = await Promise.all([
    getActivityById(id),
    getSession(),
  ]);

  if (!activity) notFound();

  // Redirect a URL canónica si el param no incluye el slug del título
  const canonicalPath = activityPath(id, activity.title);
  if (`/actividades/${rawId}` !== canonicalPath) {
    redirect(canonicalPath);
  }

  // Comprobar favorito + rating del usuario autenticado
  let isFavorited = false;
  let userRating: { score: number; comment: string | null } | null = null;
  if (sessionUser) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: sessionUser.id },
      select: { id: true },
    });
    if (dbUser) {
      const [fav, existingRating] = await Promise.all([
        prisma.favorite.findUnique({
          where: { userId_activityId: { userId: dbUser.id, activityId: id } },
          select: { activityId: true },
        }),
        prisma.rating.findUnique({
          where: { userId_activityId: { userId: dbUser.id, activityId: id } },
          select: { score: true, comment: true },
        }),
      ]);
      isFavorited = fav !== null;
      userRating = existingRating;
    }
  }

  // Load public ratings summary
  const [ratingsData, ratingsAvg] = await Promise.all([
    prisma.rating.findMany({
      where: { activityId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: { select: { name: true, avatarUrl: true } } },
    }),
    prisma.rating.aggregate({
      where: { activityId: id },
      _avg: { score: true },
      _count: { score: true },
    }),
  ]);

  const mainCategory = activity.categories[0]?.category;
  const gradient = getCategoryGradient(mainCategory?.slug ?? '');
  const categoryEmoji = mainCategory ? getCategoryEmoji(mainCategory.name) : '✨';
  const scheduleItems = parseSchedule(activity.schedule);
  const priceLabel = formatPrice(activity.price, activity.priceCurrency, activity.pricePeriod);

  // JSON-LD structured data for SEO (Event schema)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: activity.title,
    description: activity.description,
    ...(activity.startDate && { startDate: new Date(activity.startDate).toISOString() }),
    ...(activity.endDate && { endDate: new Date(activity.endDate).toISOString() }),
    ...(activity.imageUrl && { image: activity.imageUrl }),
    ...(activity.location && {
      location: {
        '@type': 'Place',
        name: activity.location.name,
        ...(activity.location.address && {
          address: {
            '@type': 'PostalAddress',
            streetAddress: activity.location.address,
            addressLocality: activity.location.city?.name ?? 'Bogotá',
            addressCountry: 'CO',
          },
        }),
      },
    }),
    ...(activity.provider && {
      organizer: {
        '@type': 'Organization',
        name: activity.provider.name,
      },
    }),
    ...(priceLabel === 'Gratis'
      ? { isAccessibleForFree: true }
      : activity.price != null && {
          offers: {
            '@type': 'Offer',
            price: typeof activity.price === 'number'
              ? activity.price
              : typeof activity.price === 'object' && activity.price !== null && 'toNumber' in activity.price
              ? (activity.price as { toNumber(): number }).toNumber()
              : Number(activity.price),
            priceCurrency: activity.priceCurrency,
            availability: 'https://schema.org/InStock',
          },
        }),
    ...(activity.ageMin != null && {
      typicalAgeRange: activity.ageMax != null
        ? `${activity.ageMin}-${activity.ageMax}`
        : `${activity.ageMin}+`,
    }),
  };

  return (
    <>
      {/* JSON-LD for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">

      {/* Breadcrumb */}
      <div className="mx-auto max-w-4xl px-4 pt-4">
        <a
          href="/actividades"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Volver a actividades
        </a>
      </div>

      {/* Aviso de actividad expirada */}
      {activity.status === 'EXPIRED' && (
        <div className="mx-auto max-w-4xl px-4 pt-2">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-amber-500 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Esta actividad puede ya no estar disponible
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                La fecha registrada indica que ya pasó. Te recomendamos verificar directamente
                con el organizador antes de asistir.
                {activity.sourceUrl && (
                  <>
                    {' '}
                    <a
                      href={activity.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-amber-900"
                    >
                      Ver fuente original
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 py-4 flex flex-col gap-6">

        {/* Hero: imagen real O encabezado compacto */}
        {activity.imageUrl ? (
          <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activity.imageUrl}
              alt={activity.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
                {TYPE_LABELS[activity.type] ?? activity.type}
              </span>
              {priceLabel !== 'No disponible' && (
                <span className={clsx(
                  'rounded-full px-3 py-1 text-xs font-semibold shadow-sm',
                  priceLabel === 'Gratis' ? 'bg-emerald-500 text-white' : 'bg-white/90 text-gray-700'
                )}>
                  {priceLabel}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            className="relative h-44 sm:h-56 rounded-2xl overflow-hidden flex items-center justify-center"
            style={{ background: gradient }}
          >
            {/* Emoji grande centrado */}
            <span className="text-7xl sm:text-8xl drop-shadow-lg select-none">{categoryEmoji}</span>

            {/* Badges superpuestos */}
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="rounded-full bg-black/30 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white shadow-sm">
                {TYPE_LABELS[activity.type] ?? activity.type}
              </span>
              {priceLabel !== 'No disponible' && (
                <span className={clsx(
                  'rounded-full px-3 py-1 text-xs font-semibold shadow-sm',
                  priceLabel === 'Gratis' ? 'bg-emerald-500 text-white' : 'bg-black/30 backdrop-blur-sm text-white'
                )}>
                  {priceLabel}
                </span>
              )}
            </div>

            {/* Nombre de categoría abajo */}
            {mainCategory && (
              <div className="absolute bottom-3 left-3">
                <span className="rounded-full bg-black/30 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white">
                  {mainCategory.name}
                </span>
              </div>
            )}
          </div>
        )}

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
                    {(activity.provider.name.match(/[a-zA-ZÀ-ÿ]/)?.[0] ?? activity.provider.name[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {activity.provider.slug ? (
                        <Link href={`/proveedores/${activity.provider.slug}`} className="font-medium text-gray-900 hover:text-orange-600 transition-colors">
                          {activity.provider.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-gray-900">{activity.provider.name}</span>
                      )}
                      {activity.provider.isVerified && (
                        <span className="text-xs text-indigo-500 font-medium">✓ Verificado</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {({ ACADEMY: 'Academia', INDEPENDENT: 'Independiente', INSTITUTION: 'Institución', GOVERNMENT: 'Entidad pública' } as Record<string,string>)[activity.provider.type] ?? activity.provider.type}
                    </span>
                  </div>
                  {activity.provider.slug && (
                    <Link href={`/proveedores/${activity.provider.slug}`} className="shrink-0 text-xs text-orange-500 hover:underline">
                      Ver más →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Calificaciones */}
            <div className="rounded-2xl bg-white border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Calificaciones</h2>
                {ratingsAvg._count.score > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRating value={Math.round(ratingsAvg._avg.score ?? 0)} readonly size="sm" />
                    <span className="text-sm text-gray-600 font-medium">
                      {(ratingsAvg._avg.score ?? 0).toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({ratingsAvg._count.score})
                    </span>
                  </div>
                )}
              </div>

              {/* Rating form */}
              <RatingForm
                activityId={id}
                existingScore={userRating?.score}
                existingComment={userRating?.comment}
                isAuthenticated={!!sessionUser}
              />

              {/* Recent ratings */}
              {ratingsData.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  {ratingsData.map((r) => (
                    <div key={r.id} className="flex items-start gap-3">
                      {r.user.avatarUrl ? (
                        <img src={r.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-xs font-semibold">
                          {r.user.name[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700">{r.user.name}</span>
                          <StarRating value={r.score} readonly size="sm" />
                        </div>
                        {r.comment && (
                          <p className="text-xs text-gray-500 mt-0.5">{r.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                  priceLabel === 'Gratis'
                    ? 'text-emerald-600'
                    : priceLabel === 'No disponible'
                    ? 'text-gray-400'
                    : 'text-gray-900'
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

            {/* Favorito + Compartir */}
            <div className="flex gap-3">
              <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-3 flex-shrink-0">
                <FavoriteButton
                  activityId={id}
                  initialIsFavorited={isFavorited}
                  size="md"
                />
              </div>
              <div className="flex-1">
                <ShareButton
                  id={id}
                  title={activity.title}
                  description={activity.description ?? ''}
                  imageUrl={activity.imageUrl}
                  ageMin={activity.ageMin}
                  ageMax={activity.ageMax}
                />
              </div>
            </div>

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

        {/* Disclaimer */}
        <div className="col-span-full rounded-xl bg-gray-50 border border-gray-100 p-4 text-xs text-gray-400 leading-relaxed">
          La información de esta actividad fue recopilada de fuentes públicas con fines informativos.
          Los derechos del contenido original pertenecen a sus respectivos titulares.
          Recomendamos verificar los detalles directamente con el organizador.{' '}
          <a
            href={`/contacto?motivo=reportar&url=${encodeURIComponent(canonicalPath)}`}
            className="text-orange-500 hover:underline"
          >
            Reportar error o solicitar remoción
          </a>
        </div>
      </div>
      </div>

      {/* Actividades similares */}
      <div className="mx-auto max-w-5xl px-4 pb-12">
        <SimilarActivities activityId={id} />
      </div>

      {/* Track activity view in browser history */}
      <ActivityHistoryTracker
        activityId={id}
        title={activity.title}
        imageUrl={activity.imageUrl}
      />
    </>
  );
}
