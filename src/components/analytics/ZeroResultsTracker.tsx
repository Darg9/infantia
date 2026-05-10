"use client";

import { useEffect, useRef } from "react";
import { trackZeroResults } from "@/lib/track";

interface ZeroResultsTrackerProps {
  query?: string;
  filters?: Record<string, string>;
  cityId?: string;
}

export function ZeroResultsTracker({ query, filters, cityId }: ZeroResultsTrackerProps) {
  const isTracked = useRef(false);

  useEffect(() => {
    if (isTracked.current) return;
    
    isTracked.current = true;
    
    trackZeroResults({
      query,
      filters,
      cityId,
      path: window.location.pathname,
    });
  }, [query, filters, cityId]);

  return null;
}
