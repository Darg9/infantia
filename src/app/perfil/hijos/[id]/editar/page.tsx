import { requireAuth, getOrCreateDbUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { EditChildForm } from './EditChildForm'

export const metadata: Metadata = {
  title: 'Editar perfil | HabitaPlan',
}

export default async function EditarHijoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireAuth()
  const dbUser = await getOrCreateDbUser(user)

  const child = await prisma.child.findFirst({
    where: { id, userId: dbUser.id },
    select: { id: true, name: true, birthDate: true, gender: true },
  })

  if (!child) notFound()

  // Formatea birthDate como "YYYY-MM-DD" para el input type="date"
  const birthDateStr = child.birthDate.toISOString().split('T')[0]

  return (
    <div className="max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-1">
        Editar perfil de {child.name}
      </h1>
      <p className="text-sm text-[var(--hp-text-secondary)] mb-8">
        Actualiza el nombre, fecha de nacimiento o género.
      </p>
      <EditChildForm
        childId={child.id}
        initialName={child.name}
        initialBirthDate={birthDateStr}
        initialGender={child.gender ?? ''}
      />
    </div>
  )
}
