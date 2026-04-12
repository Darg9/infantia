import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { DataTreatmentPDF } from '@/modules/legal/pdf/DataTreatmentPDF';
import { DATA_TREATMENT_META } from '@/modules/legal/constants/data-treatment';

// =============================================================================
// GET /api/legal/datos/pdf
// Genera y entrega el PDF de Política de Tratamiento de Datos Personales
// =============================================================================

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Log analytics/tracking optional
    console.info(JSON.stringify({
      event: 'download_data_treatment_pdf',
      version: DATA_TREATMENT_META.version,
      timestamp: new Date().toISOString()
    }));

    // 2. Generar el PDF buffer
    const buffer = await renderToBuffer(React.createElement(DataTreatmentPDF));

    // 3. Entregar archivo con el nombre correcto forzando descarga
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${DATA_TREATMENT_META.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[PDF] Error generando PDF de tratamiento de datos:', error);
    return new Response('Error generando el documento PDF.', { status: 500 });
  }
}
