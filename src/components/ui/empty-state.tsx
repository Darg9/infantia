import * as React from "react"
import { Search } from "lucide-react"
import { Icon } from "@/components/ui/Icon"

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-12">
      <Icon icon={Search} size="xl" muted />
      <h3 className="mt-4 text-hp-text-primary font-semibold">{title}</h3>
      <p className="mt-2 text-hp-text-secondary max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
