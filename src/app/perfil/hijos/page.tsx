import { requireAuth, getOrCreateDbUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import type { Metadata } from 'next'
import { DeleteChildButton } from './DeleteChildButton'

export const metadata: Metadata = {
  title: 'Mis hijos',
}

function calcAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

export default async function HijosPage() {
  const user = await requireAuth()

  const dbUser = await getOrCreateDbUser(user)

  const children = await prisma.child.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis hijos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Los perfiles ayudan a filtrar actividades por edad e intereses.
          </p>
        </div>
        <Link
          href="/perfil/hijos/nuevo"
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
        >
          + Agregar
        </Link>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">👶</p>
          <p className="text-gray-500 text-sm mb-4">Aun no has agregado perfiles de hijos.</p>
          <Link
            href="/perfil/hijos/nuevo"
            className="text-brand-600 text-sm font-medium hover:underline"
          >
            Agregar primer perfil
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {children.map((child) => {
            const age = calcAge(new Date(child.birthDate))
            return (
              <li
                key={child.id}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold text-sm">
                    {child.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{child.name}</p>
                    <p className="text-xs text-gray-400">
                      {age} {age === 1 ? 'ano' : 'anos'} ·{' '}
                      {new Date(child.birthDate).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <DeleteChildButton id={child.id} name={child.name} />
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-gray-400 mt-6 leading-relaxed">
        Los datos de tus hijos se tratan conforme a nuestra{' '}
        <Link href="/tratamiento-datos" className="underline hover:text-gray-600">
          Politica de Tratamiento de Datos
        </Link>
        . Puedes eliminar cualquier perfil en cualquier momento.
      </p>
    </div>
  )
}
