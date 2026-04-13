"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/track";

export default function ActivityViewTracker({ activityId }: { activityId: string }) {
  useEffect(() => {
    trackEvent({
      type: "activity_view",
      activityId
    });
  }, [activityId]);

  return null;
}
