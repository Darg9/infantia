"use client";

import { useEffect, useRef } from "react";
import { batchTracker } from "@/lib/track";

interface FeedImpressionTrackerProps {
  activityId: string;
  context?: Record<string, unknown>;
  children: React.ReactNode;
}

/**
 * Discovery Observability Layer
 * Mide qué actividades entran en el viewport (50% visibles por > 1s).
 * Usa un BatchTracker interno para evitar sobrecarga (batching + deduplicación por sesión).
 */
export function FeedImpressionTracker({ activityId, context, children }: FeedImpressionTrackerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timer: NodeJS.Timeout;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Iniciar conteo de 1 segundo
          timer = setTimeout(() => {
            batchTracker.trackFeedImpression(activityId, context);
          }, 1000);
        } else {
          // Si sale del viewport antes de 1s, cancelar
          if (timer) clearTimeout(timer);
        }
      },
      {
        threshold: 0.5, // 50% visible
      }
    );

    observer.observe(el);

    return () => {
      observer.unobserve(el);
      if (timer) clearTimeout(timer);
    };
  }, [activityId, context]);

  return (
    <div ref={ref} className="h-full w-full">
      {children}
    </div>
  );
}
