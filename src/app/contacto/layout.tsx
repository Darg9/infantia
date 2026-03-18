import { Suspense } from 'react'
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Contáctanos para consultas, reportar errores, solicitar remoción de contenido o ejercer tus derechos sobre datos personales.',
};

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen" />}>{children}</Suspense>;
}
