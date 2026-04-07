'use client';

import { useState } from 'react';

type ContentMode = 'text' | 'image' | 'both';

interface InstagramConfigProps {
  sourceId: string;
  initialConfig: Record<string, unknown> | null;
}

export function InstagramConfig({ sourceId, initialConfig }: InstagramConfigProps) {
  const config = (initialConfig ?? {}) as { contentMode?: ContentMode; maxPosts?: number };

  const [contentMode, setContentMode] = useState<ContentMode>(config.contentMode ?? 'text');
  const [maxPosts, setMaxPosts] = useState<number>(config.maxPosts ?? 6);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/scraping/sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { contentMode, maxPosts } }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const modeLabels: Record<ContentMode, { label: string; desc: string; cost: string }> = {
    text:  { label: 'Solo texto',   desc: 'Caption y fecha — sin imágenes',    cost: '~12 MB/corrida' },
    image: { label: 'Solo imágenes', desc: 'URLs de imágenes — sin caption',   cost: '~35 MB/corrida' },
    both:  { label: 'Texto + imagen', desc: 'Caption, fecha e imágenes',       cost: '~35 MB/corrida' },
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-500 tracking-wide mb-3">Configuración Instagram</p>

      <div className="flex flex-wrap items-end gap-6">
        {/* Content mode */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Contenido a extraer</label>
          <div className="flex gap-2">
            {(Object.keys(modeLabels) as ContentMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setContentMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  contentMode === mode
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                }`}
              >
                {modeLabels[mode].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {modeLabels[contentMode].desc} · <span className="font-medium">{modeLabels[contentMode].cost}</span>
          </p>
        </div>

        {/* Max posts */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Posts por corrida</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={12}
              value={maxPosts}
              onChange={(e) => setMaxPosts(Number(e.target.value))}
              className="w-28 accent-orange-500"
            />
            <span className="text-sm font-semibold text-gray-700 w-6 text-center">{maxPosts}</span>
          </div>
        </div>

        {/* Guardar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && <span className="text-xs text-green-600 font-medium">✓ Guardado</span>}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      </div>
    </div>
  );
}
