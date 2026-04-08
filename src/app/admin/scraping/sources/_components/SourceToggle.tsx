'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SourceToggleProps {
  sourceId: string;
  sourceName: string;
  isActive: boolean;
}

export function SourceToggle({ sourceId, sourceName, isActive }: SourceToggleProps) {
  const [active, setActive] = useState(isActive);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    setLoading(true);
    const next = !active;
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setActive(next);
      router.refresh();
    } catch {
      alert(`No se pudo ${next ? 'activar' : 'desactivar'} ${sourceName}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={active ? 'Desactivar fuente' : 'Activar fuente'}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${active ? 'bg-green-500' : 'bg-gray-300'}
        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
          ${active ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
}
