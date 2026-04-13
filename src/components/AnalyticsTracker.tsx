"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "../lib/track";

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // pathname check mitigates accidental edge renders triggering 
    if (pathname) {
      trackEvent({
        type: "page_view",
        path: pathname
      });
    }
  }, [pathname]);

  return null;
}
