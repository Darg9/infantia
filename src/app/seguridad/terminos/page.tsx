import type { Metadata } from 'next';
import { TermsContent } from '@/modules/legal/components/TermsContent';

export const metadata: Metadata = {
  title: 'Términos de uso | HabitaPlan',
  description: 'Términos y condiciones de uso de la plataforma HabitaPlan.',
};

export default function SeguridadTerminosPage() {
  return <TermsContent />;
}
