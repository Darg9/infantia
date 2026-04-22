'use client';
import { Button, Input } from '@/components/ui';

import { useState } from 'react'
import Link from 'next/link'

type ContribucionTipo = 'actividad' | 'institucion' | null

export default function ContribuirPage() {
  const [tipo, setTipo] = useState<ContribucionTipo>(null)

  const handleSubmit = (tipoContribucion: 'actividad' | 'institucion') => {
    const subject = encodeURIComponent(
      tipoContribucion === 'actividad'
        ? '[HabitaPlan] Sugerir nueva actividad'
        : '[HabitaPlan] Sugerir institución o proveedor'
    )
    const body = encodeURIComponent(
      tipoContribucion === 'actividad'
        ? 'Nombre de la actividad:\n\nInstitucion/Proveedor:\n\nDescripción:\n\nEdad recomendada:\n\nPrecio (si aplica):\n\nURL o fuente de información:\n\nObservaciones adicionales:'
        : 'Nombre de la institución o proveedor:\n\nCategoria de actividades:\n\nUrl del sitio web:\n\nRedes sociales:\n\nContacto / Email:\n\nObservaciones:'
    )
    window.location.href = `mailto:info@habitaplan.com?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen bg-[var(--hp-bg-page)]">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <Link
          href="/actividades"
          className="inline-flex items-center gap-1 text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] transition-colors"
        >
          ← Volver a actividades
        </Link>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold text-[var(--hp-text-primary)] mb-3">Ayúdanos a crecer</h1>
        <p className="text-gray-600 mb-8">
          HabitaPlan funciona gracias a familias como la tuya. Si conoces una actividad o institución que debería estar
          aquí, ¡cuéntanos!
        </p>

        {!tipo ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Card: Sugerir actividad */}
            <Button
              onClick={() => setTipo('actividad')}
              className="group relative rounded-2xl border-2 border-[var(--hp-border)] bg-[var(--hp-bg-surface)] p-6 text-left hover:border-brand-300 hover:bg-brand-50 transition-all"
            >
              <div className="absolute top-4 right-4 text-2xl">📝</div>
              <h2 className="text-xl font-bold text-[var(--hp-text-primary)] mb-2">Sugerir una actividad</h2>
              <p className="text-sm text-gray-600 mb-4">
                ¿Conoces un taller, club, campamento o evento que no aparece en HabitaPlan?
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-brand-600 group-hover:translate-x-1 transition-transform">
                Continuar →
              </span>
            </Button>

            {/* Card: Sugerir institución */}
            <Button
              onClick={() => setTipo('institucion')}
              className="group relative rounded-2xl border-2 border-[var(--hp-border)] bg-[var(--hp-bg-surface)] p-6 text-left hover:border-brand-300 hover:bg-brand-50 transition-all"
            >
              <div className="absolute top-4 right-4 text-2xl">🏢</div>
              <h2 className="text-xl font-bold text-[var(--hp-text-primary)] mb-2">Sugerir una institución</h2>
              <p className="text-sm text-gray-600 mb-4">
                ¿Hay una academia, biblioteca o centro comunitario que ofrezca actividades?
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-brand-600 group-hover:translate-x-1 transition-transform">
                Continuar →
              </span>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] p-8">
            <Button
              onClick={() => setTipo(null)}
              className="mb-6 text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] transition-colors"
            >
              ← Volver
            </Button>

            {tipo === 'actividad' ? (
              <>
                <h2 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-2">Sugerir una actividad</h2>
                <p className="text-gray-600 mb-6">
                  Completa el formulario abajo. Te enviaremos un email con los detalles que necesitamos.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSubmit('actividad')
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
                      Nombre de la actividad *
                    </label>
                    <Input
                      type="text"
                      placeholder="Ej: Taller de programación infantil"
                      className="w-full rounded-lg border border-[var(--hp-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
                      Institución o proveedor *
                    </label>
                    <Input
                      type="text"
                      placeholder="Ej: Academia Tech Kids"
                      className="w-full rounded-lg border border-[var(--hp-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
                      URL o fuente de información *
                    </label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      className="w-full rounded-lg border border-[var(--hp-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full rounded-lg bg-brand-500 text-white font-medium py-2 hover:bg-brand-600 transition-colors text-sm"
                  >
                    Enviar sugerencia
                  </Button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-2">Sugerir una institución</h2>
                <p className="text-gray-600 mb-6">
                  Ayúdanos a encontrar nuevos proveedores de actividades. Cuéntanos sobre una academia, centro comunitario o institución que ofrezca actividades para niños.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSubmit('institucion')
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
                      Nombre de la institución *
                    </label>
                    <Input
                      type="text"
                      placeholder="Ej: Centro Deportivo Municipal"
                      className="w-full rounded-lg border border-[var(--hp-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
                      Tipo de actividades
                    </label>
                    <Input
                      type="text"
                      placeholder="Ej: Deportes, arte, música"
                      className="w-full rounded-lg border border-[var(--hp-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
                      Sitio web
                    </label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      className="w-full rounded-lg border border-[var(--hp-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full rounded-lg bg-brand-500 text-white font-medium py-2 hover:bg-brand-600 transition-colors text-sm"
                  >
                    Enviar sugerencia
                  </Button>
                </form>
              </>
            )}
          </div>
        )}

        {/* Nota informativa */}
        <div className="mt-12 rounded-xl bg-[var(--hp-bg-subtle)] border border-indigo-100 p-4 text-xs text-indigo-700">
          <p className="font-semibold mb-1">📬 ¿Qué pasa después?</p>
          <p>Revisaremos tu sugerencia en máximo 5 días hábiles. Si la actividad o institución cumple con nuestros criterios, aparecerá pronto en HabitaPlan.</p>
        </div>
      </div>
    </div>
  );
}
