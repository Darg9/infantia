import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
// eslint-disable-next-line no-restricted-imports
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ToastProvider } from "@/components/ui/toast";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  // 700 primero: next/font preloads el primer peso declarado.
  // H1 usa font-bold (700) — es el LCP element, necesita preload prioritario.
  // 300 eliminado: no se usa en ningún componente activo.
  weight: ["700", "600", "400"],
  display: 'swap',
});

import { SITE_URL } from '@/config/site';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'HabitaPlan — Actividades para niños en Colombia',
    template: '%s | HabitaPlan',
  },
  description:
    'Descubre talleres, clubes, campamentos y eventos para niños y familias en Colombia. Todo en un solo lugar, siempre actualizado.',
  keywords: [
    'actividades para niños',
    'talleres infantiles',
    'eventos familiares',
    'Bogotá',
    'campamentos',
    'cursos para niños',
  ],
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'HabitaPlan',
    title: 'HabitaPlan — Actividades para niños en Colombia',
    description:
      'Descubre talleres, clubes, campamentos y eventos para niños y familias en Colombia.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HabitaPlan — Actividades para niños en Colombia',
    description:
      'Descubre talleres, clubes, campamentos y eventos para niños y familias en Colombia.',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
    // hreflang: señala a Google que el contenido es en español colombiano.
    // x-default → versión canónica para usuarios sin región específica.
    languages: {
      'es-CO': '/',
      'x-default': '/',
    },
  },
};

import AnalyticsTracker from "@/components/AnalyticsTracker";
import IntentResolver from "@/components/IntentResolver";
import { TimeToFirstActivityTracker } from "@/components/analytics/TimeToFirstActivityTracker";
import { safeJsonLd } from '@/lib/json-ld';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* ── Script anti-flash: se ejecuta de forma síncrona antes del render ──
          Prioridad: localStorage.theme > prefers-color-scheme del sistema.
          El fallback hardened evita valores corruptos en localStorage. */}
      <head>
        <meta name="color-scheme" content="light dark" />
        {/* \u2500\u2500 Regla CSS sincr\u00f3nica anti-flash \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
            Aplica ANTES de que cargue cualquier stylesheet externo (el browser
            procesa <style> inline al momento de parsear, sin round-trip de red).
            Especificidad html.dark (0,1,1) > html (0,1,0) \u2192 gana al CSS externo.
            No requiere inline style en JS ni removeProperty posterior. */}
        <style>{`html.dark,html.dark body{background-color:#0b1220}`}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var d = document.documentElement;
                d.classList.add('no-transition');

                // 1. localStorage — fuente principal
                var saved = null;
                var lsBlocked = false;
                try { saved = localStorage.getItem('theme'); } catch(e2) { lsBlocked = true; }

                // 2. Cookie hp-theme — SOLO cuando localStorage está completamente bloqueado
                //    (Brave Shields, incógnito estricto con storage bloqueado).
                //    Si lsBlocked=false y saved=null → sin elección manual → NO leer cookie
                //    (podría ser stale de versiones anteriores que escribían la cookie en
                //    auto-detección del sistema, causando que una visita con sistema=light
                //    bloqueara futuros cambios del SO durante 1 año).
                if (lsBlocked) {
                  var m = document.cookie.match(/(?:^|;\\s*)hp-theme=(dark|light)/);
                  if (m) saved = m[1];
                }

                // 3. OS preference — último recurso
                var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var theme = (saved === 'dark' || saved === 'light')
                  ? saved
                  : (systemDark ? 'dark' : 'light');

                if (theme === 'dark') {
                  d.classList.add('dark');
                } else {
                  d.classList.remove('dark');
                }

                // IMPORTANTE: NO escribir cookie aquí aunque no exista.
                // La cookie solo se escribe cuando el usuario elige explícitamente
                // (toggleTheme en ThemeProvider). Si la escribimos aquí, una visita
                // con sistema=light crea hp-theme=light que bloquea futuras
                // detecciones del sistema durante 1 año (bug: sistema cambia a dark
                // pero la cookie stale gana y la app ignora el cambio).

                // no-transition es eliminada por ThemeProvider.useLayoutEffect —
                // NO usar rAF aquí: rAF puede disparar antes de que React confirme
                // el tema y CSS haya aplicado las variables, lo que activaría las
                // transiciones de 180ms en el momento equivocado → flash visible.
              } catch(e) {}
            `,
          }}
        />
        {/* ── Organization schema — entidad HabitaPlan para Knowledge Graph ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'HabitaPlan',
            url: SITE_URL,
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.svg` },
            description: 'Plataforma de descubrimiento de actividades para niños y familias en Colombia.',
            areaServed: { '@type': 'Country', name: 'Colombia' },
            knowsAbout: ['actividades infantiles', 'planes familiares', 'eventos culturales', 'talleres infantiles'],
            contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', url: `${SITE_URL}/contacto` },
          })}}
        />
        {/* Preconnect al CDN de imágenes (Supabase Storage) → LCP más rápido */}
        <link rel="preconnect" href="https://vjfhlrpfubbfnvpthwym.supabase.co" />
        <link rel="dns-prefetch" href="https://vjfhlrpfubbfnvpthwym.supabase.co" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/logo-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${montserrat.variable} font-sans antialiased bg-[var(--hp-bg-page)] text-[var(--hp-text-primary)]`}
      >
        <AnalyticsTracker />
        <TimeToFirstActivityTracker />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <IntentResolver />
              <div className="flex flex-col min-h-screen">
                <a href="#main-content" className='sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-hp-action-primary text-white rounded-xl shadow-[var(--hp-shadow-md)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hp-action-primary'>
                  Saltar al contenido
                </a>
                <Header />
                <main id="main-content" className="flex-1 pb-20 md:pb-0">{children}</main>
                <Footer />
              </div>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
