'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Metadata } from 'next'

const MOTIVOS = [
  'Consulta general',
  'Reportar error en una actividad',
  'Solicitud de remoción de contenido',
  'Ejercer derechos de datos personales (acceso, rectificación, cancelación)',
  'Sugerir una fuente de actividades',
  'Otro',
] as const

// Metadata must be in a separate layout or generated via generateMetadata for client components
// We use a page-level title via document.title as fallback

export default function ContactoPage() {
  const searchParams = useSearchParams()
  const [motivo, setMotivo] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [actividadUrl, setActividadUrl] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Preseleccionar motivo y URL desde query params
  useEffect(() => {
    const motivoParam = searchParams?.get('motivo')
    if (motivoParam === 'reportar') {
      setMotivo('Reportar error en una actividad')
    }
    const urlParam = searchParams?.get('url')
    if (urlParam) {
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://infantia.co'
      setActividadUrl(`${base}${urlParam}`)
    }
  }, [searchParams])

  const isTakedown = motivo === 'Solicitud de remoción de contenido'
  const isDerechos = motivo === 'Ejercer derechos de datos personales (acceso, rectificación, cancelación)'
  const isReporte = motivo === 'Reportar error en una actividad'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // For MVP, we send to a mailto link since there's no backend endpoint yet
    const subject = encodeURIComponent(`[Infantia] ${motivo}`)
    const body = encodeURIComponent(
      `Nombre: ${nombre}\nCorreo: ${email}\nMotivo: ${motivo}${actividadUrl ? `\nURL actividad: ${actividadUrl}` : ''}\n\nMensaje:\n${mensaje}`
    )
    window.location.href = `mailto:contacto@infantia.co?subject=${subject}&body=${body}`

    setLoading(false)
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-8">
          <span className="text-4xl block mb-4">✓</span>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Solicitud recibida</h1>
          <p className="text-gray-600">
            Se abrió su cliente de correo con los datos del formulario. Si no se abrió automáticamente,
            puede escribirnos directamente a <strong>contacto@infantia.co</strong>.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            {isTakedown
              ? 'Responderemos a solicitudes de remoción en un máximo de 5 días hábiles.'
              : isDerechos
              ? 'Responderemos a solicitudes de datos personales en un máximo de 10 días hábiles.'
              : 'Responderemos a la brevedad posible.'}
          </p>
          <button
            onClick={() => { setEnviado(false); setMotivo(''); setNombre(''); setEmail(''); setMensaje(''); setActividadUrl(''); }}
            className="mt-6 text-sm text-orange-600 hover:underline"
          >
            Enviar otra solicitud
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Contacto</h1>
      <p className="text-gray-500 text-sm mb-8">
        Escríbenos para consultas, reportar errores, solicitar remoción de contenido o ejercer tus derechos
        sobre datos personales.
      </p>

      {/* Takedown notice - always visible */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-8">
        <h2 className="text-sm font-semibold text-orange-800 mb-1">Remoción de contenido</h2>
        <p className="text-sm text-orange-700">
          Si eres titular de contenido publicado en Infantia y deseas su modificación o remoción,
          selecciona el motivo <strong>&quot;Solicitud de remoción de contenido&quot;</strong> abajo.
          Nos comprometemos a responder en un máximo de <strong>5 días hábiles</strong>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Motivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motivo de contacto <span className="text-red-500">*</span>
          </label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Seleccione un motivo</option>
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Tu nombre"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Correo electrónico <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="tu@correo.com"
          />
        </div>

        {/* URL de actividad - conditional */}
        {(isReporte || isTakedown) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL de la actividad en Infantia {isTakedown && <span className="text-red-500">*</span>}
            </label>
            <input
              type="url"
              value={actividadUrl}
              onChange={(e) => setActividadUrl(e.target.value)}
              required={isTakedown}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="https://infantia.co/actividades/..."
            />
            <p className="text-xs text-gray-400 mt-1">Copie la URL de la actividad desde la barra de su navegador</p>
          </div>
        )}

        {/* Info adicional for takedown */}
        {isTakedown && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Para procesar su solicitud necesitamos:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Nombre de la organización que representa</li>
              <li>Relación con el contenido (titular, representante autorizado)</li>
              <li>Motivo de la solicitud de remoción</li>
            </ul>
            <p className="mt-1">Incluya esta información en el mensaje.</p>
          </div>
        )}

        {/* Info adicional for derechos */}
        {isDerechos && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Para ejercer sus derechos (Ley 1581 de 2012):</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Indique qué derecho desea ejercer (acceso, rectificación, cancelación, oposición)</li>
              <li>Correo electrónico con el que se registró en Infantia</li>
              <li>Descripción de su solicitud</li>
            </ul>
            <p className="mt-1">Responderemos en un plazo máximo de 10 días hábiles.</p>
          </div>
        )}

        {/* Mensaje */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mensaje <span className="text-red-500">*</span>
          </label>
          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            required
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
            placeholder="Describe tu consulta o solicitud..."
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </form>

      {/* Plazos legales */}
      <div className="mt-8 rounded-xl border border-gray-100 p-4 text-xs text-gray-400 space-y-1">
        <p><strong className="text-gray-500">Plazos de respuesta:</strong></p>
        <p>Consultas generales: a la brevedad posible</p>
        <p>Remoción de contenido: máximo 5 días hábiles</p>
        <p>Derechos de datos personales (consulta): máximo 10 días hábiles</p>
        <p>Derechos de datos personales (reclamo): máximo 15 días hábiles</p>
      </div>
    </div>
  )
}
