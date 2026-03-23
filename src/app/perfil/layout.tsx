import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ProfileSidebar } from '@/components/profile/ProfileSidebar'

export default async function PerfilLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { name: true, avatarUrl: true },
  })

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)]">
      <ProfileSidebar
        userName={dbUser?.name ?? user.user_metadata?.name ?? ''}
        userEmail={user.email ?? ''}
        avatarUrl={dbUser?.avatarUrl ?? null}
      />
      <main className="flex-1 bg-gray-50">
        {children}
      </main>
    </div>
  )
}
