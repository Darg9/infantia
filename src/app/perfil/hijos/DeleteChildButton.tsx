'use client';
import { Button } from "@/components/ui/button";

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteChildButton({ id, name }: { id: string; name: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`¿Eliminar el perfil de ${name}? Esta acción no se puede deshacer.`)) return
    setLoading(true)
    await fetch(`/api/children/${id}`, { method: 'DELETE' })
    router.refresh()
    setLoading(false)
  }

  return (
    <Button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-error-400 hover:text-error-600 transition-colors disabled:opacity-40"
    >
      {loading ? 'Eliminando...' : 'Eliminar'}
    </Button>
  );
}
