export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-hp-bg-subtle rounded ${className}`} />;
}
