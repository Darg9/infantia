// loading.tsx — Skeleton para /perfil/favoritos

function CardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="h-20 bg-gray-200" />
      <div className="flex flex-col gap-2.5 p-4">
        <div className="h-4 w-20 rounded-full bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-full rounded bg-gray-100 mt-1" />
        <div className="h-3 w-5/6 rounded bg-gray-100" />
        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
          <div className="h-3 w-16 rounded bg-gray-100" />
          <div className="h-3 w-12 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export default function FavoritosLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="h-8 w-40 rounded-lg bg-gray-200 animate-pulse" />
      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
