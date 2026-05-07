import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contribuir — Sugerir actividades o fuentes | HabitaPlan',
  description: 'Ayúdanos a crecer. Sugiere nuevas actividades o instituciones que deberían estar en HabitaPlan.',
  alternates: { canonical: '/contribuir' },
}

export default function ContribuirLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
