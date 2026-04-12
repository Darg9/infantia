import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { TermsPDF } from '@/modules/legal/pdf/TermsPDF';
import { TERMS_META } from '@/modules/legal/constants/terms';

// =============================================================================
// GET /api/legal/terminos/pdf
// Genera y entrega el PDF de Términos y Condiciones de HabitaPlan
// =============================================================================

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Log analytics/tracking optional
    console.info(JSON.stringify({
      event: 'download_terms_pdf',
      version: TERMS_META.version,
      timestamp: new Date().toISOString()
    }));

    // 2. Generar el PDF buffer
    const buffer = await renderToBuffer(React.createElement(TermsPDF));

    // 3. Entregar archivo con el nombre correcto forzando descarga
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${TERMS_META.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[PDF] Error generando PDF de términos:', error);
    return new Response('Error generando el documento PDF.', { status: 500 });
  }
}
