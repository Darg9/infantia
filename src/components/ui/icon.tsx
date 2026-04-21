import { LucideIcon } from "lucide-react";
import clsx from "clsx";

type IconSize = "sm" | "md" | "lg" | "xl";

const sizeMap = {
  sm: 16,
  md: 18,
  lg: 20,
  xl: 22,
};

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  active?: boolean;
  muted?: boolean;
}

export function Icon({
  icon: IconComponent,
  size = "md",
  className,
  active = false,
  muted = false,
}: IconProps) {
  return (
    <IconComponent
      size={sizeMap[size]}
      strokeWidth={1.5}
      className={clsx(
        "transition-colors",
        active && "text-[var(--color-brand-500,var(--hp-accent,#FF8C00))]",
        muted && "opacity-60",
        !active && !muted && "text-current",
        className
      )}
    />
  );
}
