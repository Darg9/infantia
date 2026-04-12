import type { Metadata } from 'next';
import { PrivacyContent } from '@/modules/legal/components/PrivacyContent';

// =============================================================================
// /seguridad/privacidad — Política de Privacidad HabitaPlan
// Layout padre: seguridad/layout.tsx (agrega ← back + tabs)
// =============================================================================

export const metadata: Metadata = {
  title: 'Privacidad | HabitaPlan',
  description:
    'Política de Privacidad de HabitaPlan. Cómo recolectamos, usamos y protegemos tu información personal conforme a la Ley 1581 de 2012.',
};

export default function SeguridadPrivacidadPage() {
  return <PrivacyContent />;
}
