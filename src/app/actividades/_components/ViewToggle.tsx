'use client';
import { Button } from '@/components/ui';
// =============================================================================
// ViewToggle — alterna entre vista Lista y Mapa en /actividades
// =============================================================================

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface Props {
  view: 'list' | 'map';
}

export function ViewToggle({ view }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  function setView(v: 'list' | 'map') {
    const sp = new URLSearchParams(searchParams.toString());
    if (v === 'list') sp.delete('view');
    else sp.set('view', 'map');
    sp.delete('page'); // volver a página 1
    router.push(`${pathname}?${sp.toString()}`);
  }

  const base    = 'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors';
  const active  = `${base} bg-indigo-600 text-white`;
  const inactive = `${base} text-gray-600 hover:bg-[var(--hp-bg-page)]`;

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] p-1 shadow-sm">
      <Button onClick={() => setView('list')} className={view === 'list' ? active : inactive}>
        📋 Lista
      </Button>
      <Button onClick={() => setView('map')} className={view === 'map' ? active : inactive}>
        🗺 Mapa
      </Button>
    </div>
  );
}
