import Link from 'next/link';
import { DownloadPDFButton } from '@/modules/legal/components/DownloadPDFButton';
import { PRIVACY_SECTIONS, PRIVACY_SUMMARY, PRIVACY_META } from '@/modules/legal/constants/privacy';

// =============================================================================
// PrivacyContent — Fuente de verdad para la Política de Privacidad
// Usado en: /privacidad y /seguridad/privacidad
// =============================================================================

export function PrivacyContent() {
  return (
    <div className="space-y-10">

      {/* ── Card — Resumen para humanos ──────────────────────── */}
      <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🛡️</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
            Privacidad — Resumen para humanos (versión segura)
          </span>
        </div>

        <ul className="space-y-4 text-sm text-[var(--hp-text-muted)] leading-relaxed">
          {PRIVACY_SUMMARY.map(({ title, description }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="text-green-400 font-bold shrink-0 mt-0.5">✓</span>
              <span>
                <strong className="text-white">{title}:</strong>{' '}
                {description}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 pt-5 border-t border-gray-700 flex flex-col sm:flex-row gap-2 justify-between text-xs text-[var(--hp-text-secondary)]">
          <span>Última actualización: {PRIVACY_META.lastUpdated}.</span>
          <span>Versión completa: Este resumen es informativo. El documento legal completo aplica en caso de duda o interpretación.</span>
        </div>
      </div>

      {/* ── Fecha y Versión ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--hp-text-secondary)]">
          Fecha de última actualización:{' '}
          <span className="font-medium text-[var(--hp-text-primary)]">{PRIVACY_META.lastUpdated}</span>
        </p>
        <span className="text-xs font-medium text-[var(--hp-text-muted)] bg-gray-100 px-2 py-1 rounded">
          Versión: {PRIVACY_META.version}
        </span>
      </div>

      {/* ── Documento legal completo ─────────────────────────── */}
      <div className="space-y-8">
        {PRIVACY_SECTIONS.map(({ num, title, content }) => (
          <section key={num}>
            <h2 className="text-base font-semibold text-[var(--hp-text-primary)] mb-3">
              <span className="text-orange-500 mr-1.5">{num}.</span>
              {title}
            </h2>
            <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
              {content.map((item, i) =>
                item.type === 'bullet' ? (
                  <p key={i} className="flex items-start gap-2 ml-2">
                    <span className="text-orange-400 shrink-0">•</span>
                    <span>{item.text}</span>
                  </p>
                ) : (
                  <p key={i}>{item.text}</p>
                )
              )}
            </div>
          </section>
        ))}
      </div>

      {/* ── Bloque final + descarga ───────────────────────────── */}
      <div className="rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-page)] p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--hp-text-primary)] mb-1">Versión completa ({PRIVACY_META.version})</p>
          <p className="text-sm text-[var(--hp-text-secondary)] leading-relaxed max-w-md">
            Este documento constituye la versión legal aplicable. Se recomienda su lectura
            antes de utilizar la plataforma.
          </p>
        </div>
        <DownloadPDFButton
          href={`/api/legal/privacidad/pdf`}
          label="Descargar Documento"
          filename={PRIVACY_META.filename}
          eventName="download_privacy_pdf_client"
        />
      </div>

      {/* ── Navegación inferior ──────────────────────────────── */}
      <div className="flex flex-wrap gap-6 text-sm pt-4 border-t border-[var(--hp-border)]">
        <Link
          href="/seguridad/terminos"
          className="text-[var(--hp-text-secondary)] hover:text-orange-600 transition-colors"
        >
          Términos →
        </Link>
        <Link
          href="/seguridad"
          className="text-[var(--hp-text-secondary)] hover:text-orange-600 transition-colors"
        >
          Centro de Seguridad →
        </Link>
      </div>

    </div>
  );
}
