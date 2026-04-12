import Link from 'next/link';
import { DownloadPDFButton } from '@/modules/legal/components/DownloadPDFButton';
import { DATA_TREATMENT_SECTIONS, DATA_TREATMENT_SUMMARY, DATA_TREATMENT_META } from '@/modules/legal/constants/data-treatment';

// =============================================================================
// DataTreatmentContent — Fuente de verdad para el Tratamiento de Datos
// Usado en: /tratamiento-datos y /seguridad/datos
// =============================================================================

export function DataTreatmentContent() {
  return (
    <div className="space-y-10">

      {/* ── Card — Resumen para humanos ──────────────────────── */}
      <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🛡️</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
            Política de Datos — Resumen para humanos
          </span>
        </div>

        <ul className="space-y-4 text-sm text-gray-300 leading-relaxed">
          {DATA_TREATMENT_SUMMARY.map((description, i) => {
            const [title, rest] = description.split(': ');
            return (
              <li key={i} className="flex items-start gap-3">
                <span className="text-green-400 font-bold shrink-0 mt-0.5">✓</span>
                <span>
                  <strong className="text-white">{title}:</strong>{' '}
                  {rest}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 pt-5 border-t border-gray-700 flex flex-col sm:flex-row gap-2 justify-between text-xs text-gray-500">
          <span>Última actualización: {DATA_TREATMENT_META.lastUpdated}.</span>
          <span>Versión completa: Este resumen es informativo. El documento legal completo aplica en caso de duda o interpretación.</span>
        </div>
      </div>

      {/* ── Fecha y Versión ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Fecha de última actualización:{' '}
          <span className="font-medium text-gray-700">{DATA_TREATMENT_META.lastUpdated}</span>
        </p>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded">
          Versión: {DATA_TREATMENT_META.version}
        </span>
      </div>

      {/* ── Documento legal completo ─────────────────────────── */}
      <div className="space-y-8">
        {DATA_TREATMENT_SECTIONS.map(({ num, title, content }) => (
          <section key={num}>
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              <span className="text-orange-500 mr-1.5">{num}.</span>
              {title}
            </h2>
            <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
              {content.map((item, i) => {
                const c = item as { type: string; text: string };
                return c.type === 'bullet' ? (
                  <p key={i} className="flex items-start gap-2 ml-2">
                    <span className="text-orange-400 shrink-0">•</span>
                    <span>{c.text}</span>
                  </p>
                ) : (
                  <p key={i}>{c.text}</p>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ── Bloque final + descarga ───────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800 mb-1">Versión completa ({DATA_TREATMENT_META.version})</p>
          <p className="text-sm text-gray-500 leading-relaxed max-w-md">
            Este documento constituye la versión legal aplicable. Se recomienda su lectura
            antes de utilizar la plataforma.
          </p>
        </div>
        <DownloadPDFButton
          href={`/api/legal/datos/pdf`}
          label="Descargar Documento"
          filename={DATA_TREATMENT_META.filename}
          eventName="download_data_treatment_pdf"
        />
      </div>

      {/* ── Navegación inferior ──────────────────────────────── */}
      <div className="flex flex-wrap gap-6 text-sm pt-4 border-t border-gray-100">
        <Link
          href="/seguridad/privacidad"
          className="text-gray-500 hover:text-orange-600 transition-colors"
        >
          Privacidad →
        </Link>
        <Link
          href="/seguridad/terminos"
          className="text-gray-500 hover:text-orange-600 transition-colors"
        >
          Términos →
        </Link>
      </div>

    </div>
  );
}
