// =============================================================================
// /actividades/[id] — Página de detalle de una actividad
// Server Component: lee el ID, consulta DB, renderiza todos los datos
// =============================================================================

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getActivityById } from '@/modules/activities';
import { ShareButton } from '@/components/ShareButton';
import { FavoriteButton } from '@/components/FavoriteButton';
import { RatingForm } from '@/components/RatingForm';
import { StarRating } from '@/components/StarRating';
import { ActivityHistoryTracker } from '@/components/profile/ActivityHistoryTracker';
import { getSession, getOrCreateDbUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractActivityId, activityPath } from '@/lib/activity-url';
import { SimilarActivities } from '@/components/SimilarActivities';
import { ActivityDetailMap } from '@/components/ActivityDetailMap';
import OutboundLink from '@/components/OutboundLink';
import ActivityViewTracker from '@/components/ActivityViewTracker';
import clsx from 'clsx';
import { ACTIVITY_DISCLAIMER_FULL } from '@/modules/legal/constants/legal-disclaimers';
import { normalizePrice } from '@/lib/decimal';
import { slugify } from '@/lib/slugify';

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
      title: `${title} | HabitaPlan`,
      description,
      type: 'article',
      ...(activity.imageUrl && { images: [{ url: activity.imageUrl }] }),
    },
    twitter: {
      card: activity.imageUrl ? 'summary_large_image' : 'summary',
      title: `${title} | HabitaPlan`,
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
  const num = normalizePrice(price);
  if (num === null) return 'No disponible';
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

  // Las actividades expiradas se redirigen al listado (ya no se muestran en el portal)
  if (activity.status === 'EXPIRED') redirect('/actividades');

  // Redirect a URL canónica si el param no incluye el slug del título
  const canonicalPath = activityPath(id, activity.title);
  if (`/actividad/${rawId}` !== canonicalPath) {
    redirect(canonicalPath);
  }

  // Comprobar favorito + rating del usuario autenticado
  let isFavorited = false;
  let userRating: { score: number; comment: string | null } | null = null;
  if (sessionUser) {
    const dbUser = await getOrCreateDbUser(sessionUser);
    const [fav, existingRating] = await Promise.all([
      prisma.favorite.findFirst({
        where: { userId: dbUser.id, activityId: id },
        select: { id: true },
      }),
      prisma.rating.findUnique({
        where: { userId_activityId: { userId: dbUser.id, activityId: id } },
        select: { score: true, comment: true },
      }),
    ]);
    isFavorited = fav !== null;
    userRating = existingRating;
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
            price: normalizePrice(activity.price),
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

  // Breadcrumb JSON-LD para SEO
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://habitaplan.com' },
      { '@type': 'ListItem', position: 2, name: 'Actividades', item: 'https://habitaplan.com/actividades' },
      ...(mainCategory ? [{ '@type': 'ListItem', position: 3, name: mainCategory.name, item: `https://habitaplan.com/actividades/categoria/${mainCategory.slug}` }] : []),
      { '@type': 'ListItem', position: mainCategory ? 4 : 3, name: activity.title, item: `https://habitaplan.com${canonicalPath}` },
    ],
  };

  return (
    <>
      {/* Tracker Invisible de Visita Pura */}
      <ActivityViewTracker activityId={id} />
      {/* JSON-LD: evento + breadcrumb */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div className="min-h-screen bg-[var(--hp-bg-page)]">

      {/* Breadcrumb visual */}
      <div className="mx-auto max-w-4xl px-4 pt-4">
        <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-sm text-[var(--hp-text-muted)] flex-wrap">
          <Link href="/" className="hover:text-[var(--hp-text-secondary)] transition-colors">Inicio</Link>
          <span>/</span>
          <Link href="/actividades" className="hover:text-[var(--hp-text-secondary)] transition-colors">Actividades</Link>
          {mainCategory && (
            <>
              <span>/</span>
              <Link href={`/actividades/categoria/${mainCategory.slug}`} className="hover:text-[var(--hp-text-secondary)] transition-colors">
                {mainCategory.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-[var(--hp-text-secondary)] truncate max-w-[200px]">{activity.title}</span>
        </nav>
      </div>


      <div className="mx-auto max-w-4xl px-4 py-4 flex flex-col gap-6">

        {/* ── Hero: título siempre protagonista ───────────────────────────────── */}
        {activity.imageUrl ? (

          /* CASO 1: con imagen → layout 2 columnas, imagen secundaria a la derecha */
          (<div className="rounded-2xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] overflow-hidden">
            <div className="flex flex-col sm:flex-row">

              {/* Imagen: compacta en mobile (arriba), thumbnail en desktop (derecha) */}
              <div className="h-44 sm:h-auto sm:w-56 sm:shrink-0 sm:order-last">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activity.imageUrl}
                  alt={activity.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Texto: protagonista */}
              <div className="flex-1 p-6 sm:p-8 flex flex-col gap-3">
                {/* Chips de contexto */}
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--hp-bg-subtle)] px-3 py-1 text-xs font-medium text-[var(--hp-text-secondary)]">
                    {TYPE_LABELS[activity.type] ?? activity.type}
                  </span>
                  {priceLabel !== 'No disponible' && (
                    <span className={clsx(
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      priceLabel === 'Gratis' ? 'bg-success-100 text-success-700' : 'bg-brand-50 text-brand-700'
                    )}>
                      {priceLabel}
                    </span>
                  )}
                  {activity.categories.map(({ category }) => (
                    <span key={category.id} className="rounded-full bg-[var(--hp-bg-subtle)] px-3 py-1 text-xs font-medium text-[var(--hp-text-primary)]">
                      {category.name}
                    </span>
                  ))}
                </div>

                {/* H1 */}
                <h1 className="text-2xl sm:text-3xl font-bold text-[var(--hp-text-primary)] leading-snug">
                  {activity.title}
                </h1>

                {/* Proveedor */}
                {activity.provider && (
                  <p className="text-sm text-[var(--hp-text-secondary)]">
                    por{' '}
                    {activity.provider.slug ? (
                      <Link href={`/proveedores/${activity.provider.slug}`} className="font-medium text-[var(--hp-text-primary)] hover:text-brand-600 transition-colors">
                        {activity.provider.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-[var(--hp-text-primary)]">{activity.provider.name}</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>)

        ) : (

          /* CASO 2: sin imagen → título protagonista, acento de color por categoría */
          (<div className="rounded-2xl overflow-hidden border border-[var(--hp-border)]">
            {/* Barra de color de categoría */}
            <div className="h-1.5 w-full" style={{ background: gradient }} />
            <div className="bg-[var(--hp-bg-surface)] rounded-b-2xl p-6 sm:p-8 flex flex-col gap-3">
              {/* Chips de contexto */}
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--hp-bg-subtle)] px-3 py-1 text-xs font-medium text-[var(--hp-text-secondary)]">
                  {TYPE_LABELS[activity.type] ?? activity.type}
                </span>
                {priceLabel !== 'No disponible' && (
                  <span className={clsx(
                    'rounded-full px-3 py-1 text-xs font-semibold',
                    priceLabel === 'Gratis' ? 'bg-success-100 text-success-700' : 'bg-brand-50 text-brand-700'
                  )}>
                    {priceLabel}
                  </span>
                )}
                {activity.categories.map(({ category }) => (
                  <span key={category.id} className="rounded-full bg-[var(--hp-bg-subtle)] px-3 py-1 text-xs font-medium text-[var(--hp-text-primary)]">
                    {category.name}
                  </span>
                ))}
              </div>

              {/* H1 — protagonista */}
              <h1 className="text-3xl sm:text-4xl font-bold text-[var(--hp-text-primary)] leading-tight">
                {activity.title}
              </h1>

              {/* Emoji + categoría como detalle visual secundario */}
              <div className="flex items-center gap-2">
                <span className="text-2xl select-none">{categoryEmoji}</span>
                {mainCategory && (
                  <span className="text-sm text-[var(--hp-text-secondary)]">{mainCategory.name}</span>
                )}
              </div>

              {/* Proveedor */}
              {activity.provider && (
                <p className="text-sm text-[var(--hp-text-secondary)]">
                  por{' '}
                  {activity.provider.slug ? (
                    <Link href={`/proveedores/${activity.provider.slug}`} className="font-medium text-[var(--hp-text-primary)] hover:text-brand-600 transition-colors">
                      {activity.provider.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-[var(--hp-text-primary)]">{activity.provider.name}</span>
                  )}
                </p>
              )}
            </div>
          </div>)
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Columna principal */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Descripción */}
            <div className="rounded-2xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] p-5">
              <h2 className="text-sm font-semibold text-[var(--hp-text-secondary)] tracking-wide mb-3">Descripción</h2>
              <p className="text-[var(--hp-text-primary)] leading-relaxed whitespace-pre-line">{activity.description}</p>
            </div>

            {/* Fechas y horarios */}
            {(activity.startDate || scheduleItems.length > 0) && (
              <div className="rounded-2xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] p-5">
                <h2 className="text-sm font-semibold text-[var(--hp-text-secondary)] tracking-wide mb-3">Fechas y horarios</h2>
                <div className="flex flex-col gap-2">
                  {activity.startDate && (
                    <div className="flex items-start gap-2 text-sm text-[var(--hp-text-primary)]">
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
                    <div key={i} className="flex items-start gap-2 text-sm text-[var(--hp-text-primary)]">
                      <span className="mt-0.5">🕐</span>
                      <span>
                        {item.startDate && formatDate(item.startDate)}
                        {item.notes && <span className="text-[var(--hp-text-secondary)]"> · {item.notes}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proveedor */}
            {activity.provider && (
              <div className="rounded-2xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] p-5">
                <h2 className="text-sm font-semibold text-[var(--hp-text-secondary)] tracking-wide mb-3">Organiza</h2>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hp-bg-subtle)] text-lg font-bold text-[var(--hp-text-primary)]">
                    {(activity.provider.name.match(/[a-zA-ZÀ-ÿ]/)?.[0] ?? activity.provider.name[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {activity.provider.slug ? (
                        <Link href={`/proveedores/${activity.provider.slug}`} className="font-medium text-[var(--hp-text-primary)] hover:text-brand-600 transition-colors">
                          {activity.provider.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-[var(--hp-text-primary)]">{activity.provider.name}</span>
                      )}
                      {activity.provider.isVerified && (
                        <span className="text-xs text-[var(--hp-text-secondary)] font-medium">✓ Verificado</span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--hp-text-muted)]">
                      {({ ACADEMY: 'Academia', INDEPENDENT: 'Independiente', INSTITUTION: 'Institución', GOVERNMENT: 'Entidad pública' } as Record<string,string>)[activity.provider.type] ?? activity.provider.type}
                    </span>
                  </div>
                  {activity.provider.slug && (
                    <Link href={`/proveedores/${activity.provider.slug}`} className="shrink-0 text-xs text-brand-500 hover:underline">
                      Ver más →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Calificaciones */}
            <div className="rounded-2xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[var(--hp-text-secondary)] tracking-wide">Calificaciones</h2>
                {ratingsAvg._count.score > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRating value={Math.round(ratingsAvg._avg.score ?? 0)} readonly size="sm" />
                    <span className="text-sm text-[var(--hp-text-secondary)] font-medium">
                      {(ratingsAvg._avg.score ?? 0).toFixed(1)}
                    </span>
                    <span className="text-xs text-[var(--hp-text-muted)]">
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
                <div className="mt-4 pt-4 border-t border-[var(--hp-border)] space-y-3">
                  {ratingsData.map((r) => (
                    <div key={r.id} className="flex items-start gap-3">
                      {r.user.avatarUrl ? (
                        // Avatar de OAuth (Google/GitHub/Supabase) — dominio variable.
                        // unoptimized evita registrar cada proveedor en remotePatterns.
                        (<Image
                          src={r.user.avatarUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover"
                          unoptimized
                        />)
                      ) : (
                        <div className="w-8 h-8 bg-[var(--hp-bg-subtle)] text-[var(--hp-text-secondary)] rounded-full flex items-center justify-center text-xs font-semibold">
                          {r.user.name[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--hp-text-primary)]">{r.user.name}</span>
                          <StarRating value={r.score} readonly size="sm" />
                        </div>
                        {r.comment && (
                          <p className="text-xs text-[var(--hp-text-secondary)] mt-0.5">{r.comment}</p>
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
            <div className="rounded-2xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] p-5 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-[var(--hp-text-secondary)] tracking-wide">Detalles</h2>

              {/* Precio */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--hp-text-secondary)]">Precio</span>
                <span className={clsx(
                  'font-semibold',
                  priceLabel === 'Gratis'
                    ? 'text-success-600'
                    : priceLabel === 'No disponible'
                    ? 'text-[var(--hp-text-muted)]'
                    : 'text-[var(--hp-text-primary)]'
                )}>{priceLabel}</span>
              </div>

              {/* Edad */}
              {(activity.ageMin !== null || activity.ageMax !== null) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--hp-text-secondary)]">Edad</span>
                  <span className="text-[var(--hp-text-primary)]">
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
                  <span className="text-[var(--hp-text-secondary)]">Capacidad</span>
                  <span className="text-[var(--hp-text-primary)]">{activity.capacity} personas</span>
                </div>
              )}

              {/* Ubicación */}
              {activity.location && (
                <div className="flex flex-col gap-0.5 text-sm border-t border-[var(--hp-border)] pt-3 mt-1">
                  <span className="text-[var(--hp-text-secondary)]">Ubicación</span>
                  <span className="text-[var(--hp-text-primary)] font-medium">{activity.location.name}</span>
                  {activity.location.address && (
                    <span className="text-[var(--hp-text-secondary)] text-xs">{activity.location.address}</span>
                  )}
                  {activity.location.neighborhood && (
                    <span className="text-[var(--hp-text-muted)] text-xs">{activity.location.neighborhood}</span>
                  )}
                  {activity.location.city && (
                    <span className="text-[var(--hp-text-muted)] text-xs">{activity.location.city.name}</span>
                  )}
                  {activity.location.latitude != null && activity.location.longitude != null && (
                    <div className="mt-3">
                      <ActivityDetailMap
                        lat={Number(activity.location.latitude)}
                        lng={Number(activity.location.longitude)}
                        locationName={activity.location.name}
                        address={activity.location.address}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CTA — link al origen */}
            {activity.sourceUrl && (
              <OutboundLink
                activityId={id}
                href={activity.sourceUrl}
                className='flex items-center justify-center gap-2 rounded-2xl bg-[var(--hp-action-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--hp-shadow-md)] hover:bg-[var(--hp-action-primary-hover)] transition-colors'
              >
              Ver sitio oficial
                <span>↗</span>
              </OutboundLink>
            )}

            {/* Favorito + Compartir */}
            <div className="flex gap-3">
              <div className="flex items-center justify-center rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-4 py-3 flex-shrink-0">
                <FavoriteButton
                  targetId={id}
                  targetType="activity"
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

            {/* Fuente y última actualización */}
            <div className="rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] p-4 flex flex-col gap-1.5 text-xs text-[var(--hp-text-muted)]">
              <div className="flex items-center justify-between">
                <span>Fuente</span>
                <span className="text-[var(--hp-text-secondary)]">
                  {activity.sourceUrl
                    ? (() => { try { return new URL(activity.sourceUrl).hostname.replace('www.', ''); } catch { return 'Proveedor externo'; } })()
                    : 'Proveedor externo'}
                </span>
              </div>
              {activity.sourceCapturedAt && (
                <div className="flex items-center justify-between">
                  <span>Última actualización</span>
                  <span className="text-[var(--hp-text-secondary)]">
                    {new Date(activity.sourceCapturedAt).toLocaleDateString('es-CO')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer legal */}
        <div className="col-span-full rounded-xl bg-[var(--hp-bg-page)] border border-[var(--hp-border)] p-4 text-xs text-[var(--hp-text-muted)] leading-relaxed">
          {ACTIVITY_DISCLAIMER_FULL}{' '}
          <a
            href={`/contacto?motivo=reportar&url=${encodeURIComponent(canonicalPath)}`}
            className="text-brand-500 hover:underline"
          >
            Reportar error o solicitar remoción
          </a>
          {/* Atribución de fuente — transparencia para usuarios, auditores e inversores */}
          {(activity.sourceUrl || activity.sourceCapturedAt) && (
            <p className="mt-2 pt-2 border-t border-[var(--hp-border)] text-[var(--hp-text-muted)] flex flex-wrap gap-x-3">
              {activity.sourceUrl && (
                <span>
                  Fuente:{' '}
                  <OutboundLink
                    activityId={id}
                    href={activity.sourceUrl}
                    className="text-[var(--hp-text-muted)] hover:text-brand-500 hover:underline transition-colors"
                  >
                    {(() => { try { return new URL(activity.sourceUrl).hostname.replace('www.', ''); } catch { return 'fuente externa'; } })()}
                  </OutboundLink>{' '}(sitio oficial)
                </span>
              )}
              {activity.sourceCapturedAt && (
                <span>
                  Última actualización:{' '}
                  {new Date(activity.sourceCapturedAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      </div>
      {/* ── SEO Interlinking (Silos Semánticos) ────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="border-t border-[var(--hp-border)] pt-8">
          <h2 className="text-sm font-bold text-[var(--hp-text-primary)] mb-4 tracking-wide uppercase">Sigue explorando</h2>
          <div className="flex flex-wrap gap-3">
            {activity.location?.city && (
              <Link 
                href={`/actividades/${slugify(activity.location.city.name)}`}
                className="inline-flex items-center rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
              >
                📍 Más planes en {activity.location.city.name}
              </Link>
            )}
            {mainCategory && activity.location?.city && (
              <Link 
                href={`/actividades/categoria/${mainCategory.slug}?cityId=${activity.location.city.id}`}
                className="inline-flex items-center rounded-full bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] px-4 py-2 text-sm font-medium text-[var(--hp-text-primary)] hover:border-brand-300 transition-colors"
              >
                {categoryEmoji} Más {mainCategory.name.toLowerCase()} en {activity.location.city.name}
              </Link>
            )}
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
