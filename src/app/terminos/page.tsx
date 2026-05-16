import type { Metadata } from 'next';
import { TermsContent } from '@/modules/legal/components/TermsContent';

// Ruta redirigida → /centro-de-confianza/terminos (301 en next.config.ts)
// Esta página no se sirve directamente. El redirect toma precedencia.
export const metadata: Metadata = {
  title: 'Términos de Uso | HabitaPlan',
  description: 'Términos y condiciones de uso de la plataforma HabitaPlan.',
  alternates: { canonical: '/centro-de-confianza/terminos' },
};

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TermsContent />
    </div>
  );
}
