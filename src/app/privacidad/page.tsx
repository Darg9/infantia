import type { Metadata } from 'next';
import { PrivacyContent } from '@/modules/legal/components/PrivacyContent';

// Ruta mantenida activa (sin redirect) — SEO preservado
// Fuente de verdad: src/modules/legal/components/PrivacyContent.tsx
export const metadata: Metadata = {
  title: 'Política de Privacidad | HabitaPlan',
  description: 'Política de privacidad de HabitaPlan. Conoce cómo protegemos tu información personal.',
};

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PrivacyContent />
    </div>
  );
}
