"use client";

// =============================================================================
// ActivityCard — tarjeta de actividad para el grid de /actividades y Home
// =============================================================================
//
// JERARQUÍA VISUAL (actualizada S68):
//   Overlay izquierdo  → label temporal contextual (Hoy · 3 PM, Mañana, Vie 16…)
//   Overlay derecho    → Gratis | ⭐ Destacado  (máximo 1, máxima señal editorial)
//   Footer             → audiencia + ubicación + proveedor + favorito
//
// Eliminado: ✓ Verificado, 🆕 Nuevo, badges de tipo (Recurrente, Única vez, Taller).
// =============================================================================

import Image from 'next/image';
import clsx from 'clsx';
import { getCategoryGradient, getCategoryEmoji } from '@/lib/category-utils';
import { FavoriteButton } from '@/components/FavoriteButton';
import { activityPath } from '@/lib/activity-url';
import { trackEvent } from '@/lib/track';
import { normalizePrice } from '@/lib/decimal';
import { highlightText } from '@/lib/highlight';
import { FeedImpressionTracker } from '@/components/analytics/FeedImpressionTracker';
import { getEditorialAudience, getAudienceEmoji } from '@/lib/audience-utils';
import { getEditorialDateLabel } from '@/lib/date-label-utils';

// Tipo local inferido desde lo que devuelve serializeActivity().
// En producción puede llegar como number, string o Decimal serializado.
type PrismaPrice = number | string | { toNumber?: () => number; valueOf?: () => unknown } | null;

interface Activity {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  audience: string;
  ageMin: number | null;
  ageMax: number | null;
  price: PrismaPrice;
  priceCurrency: string;
  pricePeriod: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  sourceDomain: string | null;
  duplicatesCount: number;
  _count?: { views: number };
  /** Acepta Date (Prisma) o ISO string (serializado vía serializeActivity) */
  createdAt: Date | string;
  /** ISO string o null — para label temporal */
  startDate?: string | Date | null;
  /** ISO string o null — para rango multi-día */
  endDate?: string | Date | null;
  /** schedule JSON { days, start, end } para recurrentes sin startDate */
  schedule?: Record<string, unknown> | unknown | null;
  provider: { name: string; isVerified: boolean; isPremium: boolean } | null;
  location: {
    name: string;
    neighborhood: string | null;
    city: { name: string } | null;
  } | null;
  categories: { category: { id: string; name: string; slug: string } }[];
}

interface ActivityCardProps {
  activity: Activity;
  /** true si el usuario autenticado ya marcó esta actividad como favorita */
  isFavorited?: boolean;
  /**
   * compact=true → vista simplificada para el home:
   * sin categorías, sin descripción, título más prominente,
   * footer reducido a ubicación + favorito
   */
  compact?: boolean;
  /** Término de búsqueda activo — se resaltan coincidencias en título y descripción */
  searchQuery?: string;
}

export default function ActivityCard({ activity, isFavorited = false, compact = false, searchQuery = '' }: ActivityCardProps) {
  const mainCategory = activity.categories[0]?.category;
  const gradient = getCategoryGradient(mainCategory?.slug ?? '');
  const categoryEmoji = mainCategory ? getCategoryEmoji(mainCategory.name) : '✨';

  const editorialAudience = getEditorialAudience(activity.ageMin, activity.ageMax, activity.audience);
  const audienceEmoji = getAudienceEmoji(editorialAudience);

  const locationLabel = activity.location?.neighborhood ?? activity.location?.city?.name ?? '';

  // ── Señales editoriales ──────────────────────────────────────────────────────
  const numPrice = normalizePrice(activity.price);
  const isGratis = numPrice === 0 || activity.pricePeriod === 'FREE';
  /** Multi-fuente = señal de relevancia cruzada */
  const isFeatured = (activity.duplicatesCount ?? 0) >= 1;

  /** Badge derecho: Gratis tiene prioridad; Destacado aparece si no es gratis */
  const rightBadge: 'gratis' | 'destacado' | null =
    isGratis ? 'gratis' : isFeatured ? 'destacado' : null;

  /** Label temporal: "Hoy", "Mañana", "Vie 16", "Este fin de semana", etc. */
  const dateLabel = getEditorialDateLabel({
    startDate: activity.startDate,
    endDate:   activity.endDate,
    schedule:  activity.schedule,
    type:      activity.type,
  });

  const cardContent = (
    <div className='group flex flex-col rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] shadow-[var(--hp-shadow-md)] transition-all duration-200 hover:shadow-[var(--hp-shadow-md)] hover:-translate-y-0.5 overflow-hidden h-full'>

      {/* ── Strip visual ─────────────────────────────────────────────────────── */}
      <div
        className={clsx(
          'relative flex items-center justify-center overflow-hidden',
          compact ? 'h-24' : 'h-20',
          activity.status === 'EXPIRED' && 'opacity-60'
        )}
        style={activity.imageUrl ? undefined : { background: gradient }}
      >
        {activity.imageUrl ? (
          (<Image
            src={activity.imageUrl}
            alt={activity.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
          />)
        ) : (
          <span className="text-4xl select-none drop-shadow-[var(--hp-shadow-md)]">{categoryEmoji}</span>
        )}

        {/* ── Overlay izquierdo: label temporal ── */}
        {dateLabel && (
          <span className='absolute top-1.5 left-2 rounded-full bg-[var(--hp-bg-surface)]/90 px-2 py-0.5 text-xs font-semibold text-[var(--hp-text-primary)] shadow-[var(--hp-shadow-md)]'>
            {dateLabel}
          </span>
        )}

        {/* ── Overlay derecho: Gratis | Destacado ── */}
        {rightBadge === 'gratis' && (
          <span className='absolute top-1.5 right-2 rounded-full bg-success-500 px-2 py-0.5 text-xs font-semibold text-white shadow-[var(--hp-shadow-md)]'>
            Gratis
          </span>
        )}
        {rightBadge === 'destacado' && (
          <span className='absolute top-1.5 right-2 rounded-full bg-warning-100 px-2 py-0.5 text-xs font-bold text-warning-900 shadow-[0_0_8px_rgba(251,191,36,0.5)] border border-warning-300'>
            ⭐ Destacado
          </span>
        )}

        {/* Badge expirada — siempre al centro-fondo */}
        {activity.status === 'EXPIRED' && (
          <span className='absolute bottom-1.5 left-0 right-0 mx-auto w-fit rounded-full bg-warning-500 px-2 py-0.5 text-xs font-semibold text-white shadow-[var(--hp-shadow-md)]'>
            Verificar disponibilidad
          </span>
        )}

        {/* Badge Sponsor — edge case, proveedor premium */}
        {activity.provider?.isPremium && (
          <span className='absolute bottom-1.5 left-2 rounded-full bg-warning-400 px-2 py-0.5 text-xs font-bold text-warning-900 shadow-[var(--hp-shadow-md)]'>
            ⭐ Sponsor
          </span>
        )}
      </div>

      {/* ── Contenido ────────────────────────────────────────────────────────── */}
      <div className={clsx('flex flex-col p-4 flex-1', compact ? 'gap-3' : 'gap-2')}>

        {/* Categorías — ocultas en compact */}
        {!compact && activity.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activity.categories.slice(0, 2).map(({ category }) => (
              <span
                key={category.id}
                className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600"
              >
                {category.name}
              </span>
            ))}
          </div>
        )}

        {/* Título — más prominente en compact */}
        <h3 className={clsx(
          'leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors',
          compact
            ? 'text-base font-bold text-[var(--hp-text-primary)]'
            : 'text-sm font-semibold text-[var(--hp-text-primary)]'
        )}>
          {highlightText(activity.title, searchQuery)}
        </h3>

        {/* Descripción — oculta en compact */}
        {!compact && (
          <p className="text-xs text-[var(--hp-text-secondary)] line-clamp-2 leading-relaxed flex-1">
            {highlightText(activity.description, searchQuery)}
          </p>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div className={clsx(
          'flex items-center mt-auto pt-2 border-t border-[var(--hp-border)]',
          compact ? 'justify-between' : 'flex-wrap gap-x-3 gap-y-1'
        )}>

          {/* Vista completa: audience + location + provider */}
          {!compact && (
            <>
              <span className="flex items-center gap-1 text-xs text-[var(--hp-text-secondary)] font-medium">
                <span>{audienceEmoji}</span> <span className="text-[var(--hp-text-primary)]">{editorialAudience}</span>
              </span>
              {locationLabel && (
                <span className="flex items-center gap-1 text-xs text-[var(--hp-text-secondary)]">
                  <span>📍</span> {locationLabel}
                </span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {activity.provider && (
                  <span className="flex items-center gap-1 text-xs text-[var(--hp-text-muted)]">
                    {activity.provider.name}
                    {activity.provider.isVerified && <span className="text-brand-500">✓</span>}
                  </span>
                )}
                <FavoriteButton
                  targetId={activity.id}
                  targetType="activity"
                  initialIsFavorited={isFavorited}
                  size="sm"
                />
              </span>
            </>
          )}

          {/* Vista compact: solo ubicación + favorito */}
          {compact && (
            <>
              {locationLabel ? (
                <span className="flex items-center gap-1 text-xs text-[var(--hp-text-secondary)]">
                  <span>📍</span> {locationLabel}
                </span>
              ) : (
                <span />
              )}
              <FavoriteButton
                targetId={activity.id}
                targetType="activity"
                initialIsFavorited={isFavorited}
                size="sm"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );

  // La tarjeta siempre enlaza a la página de detalle interna (URL canónica)
  return (
    <FeedImpressionTracker activityId={activity.id}>
      <a
        href={activityPath(activity.id, activity.title)}
        className="block h-full"
        data-activity-target="true"
        data-activity-id={activity.id}
        onClick={() => {
          trackEvent({
            type: "activity_click",
            activityId: activity.id
          });
        }}
      >
        {cardContent}
      </a>
    </FeedImpressionTracker>
  );
}
