'use client'

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
    window.location.href = `mailto:contacto@habitaplan.com?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <Link
          href="/actividades"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Volver a actividades
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Ayúdanos a crecer</h1>
        <p className="text-gray-600 mb-8">
          HabitaPlan funciona gracias a familias como la tuya. Si conoces una actividad o institución que debería estar
          aquí, ¡cuéntanos!
        </p>

        {!tipo ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Card: Sugerir actividad */}
            <button
              onClick={() => setTipo('actividad')}
              className="group relative rounded-2xl border-2 border-gray-100 bg-white p-6 text-left hover:border-orange-300 hover:bg-orange-50 transition-all"
            >
              <div className="absolute top-4 right-4 text-2xl">📝</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Sugerir una actividad</h2>
              <p className="text-sm text-gray-600 mb-4">
                ¿Conoces un taller, club, campamento o evento que no aparece en HabitaPlan?
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-orange-600 group-hover:translate-x-1 transition-transform">
                Continuar →
              </span>
            </button>

            {/* Card: Sugerir institución */}
            <button
              onClick={() => setTipo('institucion')}
              className="group relative rounded-2xl border-2 border-gray-100 bg-white p-6 text-left hover:border-orange-300 hover:bg-orange-50 transition-all"
            >
              <div className="absolute top-4 right-4 text-2xl">🏢</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Sugerir una institución</h2>
              <p className="text-sm text-gray-600 mb-4">
                ¿Hay una academia, biblioteca o centro comunitario que ofrezca actividades?
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-orange-600 group-hover:translate-x-1 transition-transform">
                Continuar →
              </span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-gray-100 p-8">
            <button
              onClick={() => setTipo(null)}
              className="mb-6 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Volver
            </button>

            {tipo === 'actividad' ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Sugerir una actividad</h2>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre de la actividad *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Taller de programación infantil"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Institución o proveedor *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Academia Tech Kids"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL o fuente de información *
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-orange-500 text-white font-medium py-2 hover:bg-orange-600 transition-colors text-sm"
                  >
                    Enviar sugerencia
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Sugerir una institución</h2>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre de la institución *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Centro Deportivo Municipal"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de actividades
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Deportes, arte, música"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sitio web
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-orange-500 text-white font-medium py-2 hover:bg-orange-600 transition-colors text-sm"
                  >
                    Enviar sugerencia
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* Nota informativa */}
        <div className="mt-12 rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-xs text-indigo-700">
          <p className="font-semibold mb-1">📬 ¿Qué pasa después?</p>
          <p>Revisaremos tu sugerencia en máximo 5 días hábiles. Si la actividad o institución cumple con nuestros criterios, aparecerá pronto en HabitaPlan.</p>
        </div>
      </div>
    </div>
  )
}
