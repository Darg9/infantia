import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { PrivacidadPDF } from '@/modules/legal/pdf/PrivacidadPDF';
import { PRIVACY_META } from '@/modules/legal/constants/privacy';

// =============================================================================
// GET /api/legal/privacidad/pdf
// Genera y entrega el PDF de Política de Privacidad de HabitaPlan
// =============================================================================

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Log analytics/tracking optional
    console.info(JSON.stringify({
      event: 'download_privacy_pdf',
      version: PRIVACY_META.version,
      timestamp: new Date().toISOString()
    }));

    // 2. Generar el PDF buffer
    const buffer = await renderToBuffer(React.createElement(PrivacidadPDF));

    // 3. Entregar archivo con el nombre correcto forzando descarga
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${PRIVACY_META.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[PDF] Error generando PDF de privacidad:', error);
    return new Response('Error generando el documento PDF.', { status: 500 });
  }
}
