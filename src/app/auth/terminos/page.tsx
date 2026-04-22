import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button, Card } from '@/components/ui'
import Link from 'next/link'

export default async function TerminosPage({ searchParams }: { searchParams: { next?: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')

  // Verificar si ya los aceptó para evitar que se queden atascados si recargan
  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: session.id }
  })
  
  const nextUrl = searchParams.next ?? '/perfil'

  if (dbUser?.termsAcceptedAt) {
    redirect(nextUrl)
  }

  async function aceptarTerminos() {
    'use server'
    const currentSession = await getSession()
    if (!currentSession) return
    
    await prisma.user.update({
      where: { supabaseAuthId: currentSession.id },
      data: { termsAcceptedAt: new Date() }
    })
    
    redirect(nextUrl)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hp-bg-page)] p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="text-4xl mb-4">📝</div>
        <h1 className="text-2xl font-bold mb-4 text-[var(--hp-text-primary)]">Acuerdo de Servicio</h1>
        <p className="text-gray-600 text-sm mb-8 leading-relaxed">
          Para continuar usando HabitaPlan, debes aceptar nuestra <Link href="/privacidad" className="text-brand-600 hover:underline" target="_blank">Política de Privacidad</Link> y los <Link href="/terminos" className="text-brand-600 hover:underline" target="_blank">Términos de Uso</Link>.
        </p>
        <form action={aceptarTerminos}>
          <Button type="submit" className="w-full">
            Aceptar y continuar
          </Button>
        </form>
      </Card>
    </div>
  )
}
