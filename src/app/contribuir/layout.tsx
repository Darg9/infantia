import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contribuir — Sugerir actividades o fuentes',
  description: 'Ayúdanos a crecer. Sugiere nuevas actividades o instituciones que deberían estar en Infantia.',
}

export default function ContribuirLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
