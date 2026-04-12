import type { Metadata } from 'next';
import { TermsContent } from '@/modules/legal/components/TermsContent';

// Ruta mantenida activa (sin redirect) — SEO preservado
// Fuente de verdad: src/modules/legal/components/TermsContent.tsx
export const metadata: Metadata = {
  title: 'Términos de Uso | HabitaPlan',
  description: 'Términos y condiciones de uso de la plataforma HabitaPlan.',
};

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TermsContent />
    </div>
  );
}
