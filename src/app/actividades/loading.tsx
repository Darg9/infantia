// =============================================================================
// loading.tsx — Skeleton de carga para /actividades
// Next.js muestra este componente automáticamente mientras page.tsx carga
// =============================================================================

function CardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] overflow-hidden animate-pulse">
      {/* Strip imagen */}
      <div className="h-20 bg-gray-200" />
      {/* Contenido */}
      <div className="flex flex-col gap-2.5 p-4">
        {/* Categoría pill */}
        <div className="h-4 w-20 rounded-full bg-gray-200" />
        {/* Título */}
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        {/* Descripción */}
        <div className="h-3 w-full rounded bg-gray-100 mt-1" />
        <div className="h-3 w-5/6 rounded bg-gray-100" />
        {/* Footer */}
        <div className="flex gap-2 mt-2 pt-2 border-t border-[var(--hp-border)]">
          <div className="h-3 w-16 rounded bg-gray-100" />
          <div className="h-3 w-12 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export default function ActividadesLoading() {
  return (
    <div className="min-h-screen bg-[var(--hp-bg-page)]">
      <div className="mx-auto max-w-7xl px-4 py-6 flex flex-col gap-6">

        {/* Título */}
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-56 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
        </div>

        {/* Filtros placeholder */}
        <div className="flex flex-col gap-2">
          <div className="h-10 rounded-xl bg-gray-200 animate-pulse" />
          <div className="h-10 w-2/3 rounded-xl bg-gray-200 animate-pulse" />
        </div>

        {/* Grid de skeletons */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
