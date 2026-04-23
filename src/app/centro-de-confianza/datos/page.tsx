import type { Metadata } from 'next';
import { DataTreatmentContent } from '@/modules/legal/components/DataTreatmentContent';

// =============================================================================
// /seguridad/datos — Política de Tratamiento de Datos Personales
// =============================================================================

export const metadata: Metadata = {
  title: 'Tratamiento de Datos Personales | HabitaPlan',
  description: 'Política de Tratamiento de Datos Personales de HabitaPlan. Información legal, finalidades y normativas aplicables.',
  alternates: {
    canonical: '/seguridad/datos',
  },
};

export default function SeguridadDatosPage() {
  return <DataTreatmentContent />;
}
