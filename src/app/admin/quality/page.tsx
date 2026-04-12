import { requireRole } from '@/lib/auth'
import { UserRole } from '@/generated/prisma/client'
import QualityDashboardClient from './client'

export const metadata = {
  title: 'Content Quality Dashboard | Admin',
}

export default async function QualityDashboardPage() {
  await requireRole([UserRole.ADMIN])

  return <QualityDashboardClient />
}
