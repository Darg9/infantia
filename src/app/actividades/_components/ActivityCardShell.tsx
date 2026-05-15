'use client';
// =============================================================================
// ActivityCardShell — Client boundary mínimo para ActivityCard
//
// Responsabilidades:
//   1. FeedImpressionTracker (IntersectionObserver → analytics de discovery)
//   2. <a> con onClick tracking (activity_click)
//
// Todo lo demás (UI de la card: imagen, título, badges, footer) es generado
// por ActivityCard (Server Component) y llega como {children} — HTML puro,
// cero hidratación React para el cuerpo de la card.
//
// Patrón RSC:
//   ActivityCard (Server) → ActivityCardShell (Client) ← recibe children del server
//                                           ↳ FavoriteButton (Client island, dentro de children)
// =============================================================================

import { FeedImpressionTracker } from '@/components/analytics/FeedImpressionTracker';
import { activityPath } from '@/lib/activity-url';
import { trackEvent } from '@/lib/track';

interface ActivityCardShellProps {
  activityId: string;
  activityTitle: string;
  children: React.ReactNode;
}

export function ActivityCardShell({ activityId, activityTitle, children }: ActivityCardShellProps) {
  return (
    <FeedImpressionTracker activityId={activityId}>
      <a
        href={activityPath(activityId, activityTitle)}
        className="block h-full"
        data-activity-target="true"
        data-activity-id={activityId}
        onClick={() => {
          trackEvent({
            type: 'activity_click',
            activityId,
          });
        }}
      >
        {children}
      </a>
    </FeedImpressionTracker>
  );
}
