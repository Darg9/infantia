import type { Metadata } from 'next';
import { PrivacyContent } from '@/modules/legal/components/PrivacyContent';

// Ruta redirigida → /centro-de-confianza/privacidad (301 en next.config.ts)
// Esta página no se sirve directamente. El redirect toma precedencia.
export const metadata: Metadata = {
  title: 'Política de Privacidad | HabitaPlan',
  description: 'Política de privacidad de HabitaPlan. Conoce cómo protegemos tu información personal.',
  alternates: { canonical: '/centro-de-confianza/privacidad' },
};

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PrivacyContent />
    </div>
  );
}
