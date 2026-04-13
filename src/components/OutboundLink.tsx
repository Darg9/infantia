"use client";

import { ReactNode } from "react";
import { trackEvent } from "@/lib/track";

interface OutboundLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  activityId: string;
  href: string;
  children: ReactNode;
}

export default function OutboundLink({ activityId, href, children, ...props }: OutboundLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        // Tracker asincrono silencioso (no aplicamos persistEvent ni un-preventDefault para evitar bloquear UI)
        trackEvent({
          type: "outbound_click",
          activityId
        });
        if (props.onClick) {
          props.onClick(e);
        }
      }}
      {...props}
    >
      {children}
    </a>
  );
}
