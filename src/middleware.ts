import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // Rutas que requieren ADMIN
  const isAdminRoute =
    pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  // Rutas que requieren auth (cualquier usuario)
  const isProtectedRoute = pathname.startsWith('/perfil')

  if (isAdminRoute || isProtectedRoute) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (isAdminRoute) {
      // El rol se lee del JWT app_metadata (Edge runtime no puede usar Prisma)
      const role = user.app_metadata?.role as string | undefined
      if (role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
