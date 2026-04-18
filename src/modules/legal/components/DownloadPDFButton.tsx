'use client';

// =============================================================================
// DownloadPDFButton — Botón cliente para descargar documentos legales en PDF
// Props: href → API route que retorna el PDF, label → texto del botón
// =============================================================================

import { useToast } from '@/components/ui/toast';
import { createLogger } from '@/lib/logger';

interface Props {
  href: string;
  label?: string;
  filename?: string;
  eventName?: string;
}

const log = createLogger('legal:pdf-download');

export function DownloadPDFButton({ href, label = 'Descargar Documento', filename, eventName = 'download_document_pdf' }: Props) {
  const { toast } = useToast();

  const handleDownload = async () => {
    try {
      log.info(eventName, {
        filename: filename || 'documento.pdf'
      });
      const res = await fetch(href);
      if (!res.ok) throw new Error('No se pudo generar el documento.');

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');

      a.href     = url;
      a.download = filename || href.split('/').pop() || 'documento.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      log.error('PDF Download failed', { error: err });
      toast.error('No se pudo descargar el documento. Intenta de nuevo más tarde.');
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-2 shrink-0 rounded-xl
                 bg-gray-900 text-white text-sm font-medium
                 px-5 py-2.5 hover:bg-gray-800
                 transition-colors cursor-pointer"
    >
      <span>↓</span>
      <span>{label}</span>
    </button>
  );
}
