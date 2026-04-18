import type { Metadata } from 'next';
import { DataTreatmentContent } from '@/modules/legal/components/DataTreatmentContent';

// =============================================================================
// /tratamiento-datos — Política de Tratamiento de Datos Personales
// =============================================================================

export const metadata: Metadata = {
  title: 'Tratamiento de Datos Personales | HabitaPlan',
  description: 'Política de Tratamiento de Datos Personales de HabitaPlan. Información legal, finalidades y normativas aplicables.',
};

export default function TratamientoDatosPage() {
  return (
    <div className="min-h-screen bg-[var(--hp-bg-page)] pt-24 pb-12 sm:pt-32 sm:pb-24">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <DataTreatmentContent />
      </main>
    </div>
  );
}
