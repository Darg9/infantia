// =============================================================================
// middleware.ts — Middleware global de Next.js
//
// Responsabilidades:
// 1. Refrescar la sesión de Supabase en todas las rutas (necesario para SSR auth)
// 2. Proteger /admin/* — solo usuarios con rol ADMIN (redirect a /login)
// 3. Proteger /api/admin/* — solo usuarios con rol ADMIN (responde JSON 401/403)
//    Excepción: rutas de cron que usan CRON_SECRET en lugar de cookies
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Rutas de cron que se autentican con CRON_SECRET, no con cookies de sesión.
// El middleware las deja pasar — cada route handler valida su propio secreto.
const CRON_PATHS = [
  '/api/admin/cron/scrape',
  '/api/admin/expire-activities',
  '/api/admin/send-notifications',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Refrescar sesión Supabase (obligatorio para que SSR auth funcione) ──
  const { supabaseResponse, user } = await updateSession(request);

  // ── 2. Proteger /admin/* (páginas UI) — redirect a /login ─────────────────
  // Cubre: /admin/source-health, /admin/sources, /admin/claims, etc.
  // Las rutas /api/admin/* se manejan en el bloque siguiente con respuesta JSON.
  if (pathname.startsWith('/admin/') || pathname === '/admin') {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
    const role = user.app_metadata?.role as string | undefined;
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // ── 3. Proteger /api/admin/* (rutas API) — responde JSON 401/403 ──────────
  if (pathname.startsWith('/api/admin/')) {
    // Cron routes se autentican con CRON_SECRET — dejar pasar
    if (CRON_PATHS.some((p) => pathname.startsWith(p))) {
      return supabaseResponse;
    }

    // Sin sesión → 401 Unauthorized
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado — se requiere autenticación' },
        { status: 401 },
      );
    }

    // Con sesión pero sin rol ADMIN → 403 Forbidden
    const role = user.app_metadata?.role as string | undefined;
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Acceso denegado — se requiere rol ADMIN' },
        { status: 403 },
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Ejecutar en todas las rutas excepto:
     * - _next/static (archivos estáticos de Next.js)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - Archivos de imagen (svg, png, jpg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
