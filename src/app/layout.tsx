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
  weight: ["300", "400", "500", "600", "700"],
});

import { SITE_URL } from '@/config/site';

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
  },
};

import AnalyticsTracker from "@/components/AnalyticsTracker";
import IntentResolver from "@/components/IntentResolver";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      {/* ── Script anti-flash: se ejecuta de forma síncrona antes del render ──
          Prioridad: localStorage.theme > prefers-color-scheme del sistema.
          El fallback hardened evita valores corruptos en localStorage. */}
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var d = document.documentElement;
                d.classList.add('no-transition');
                var saved = localStorage.getItem('theme');
                var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var theme = saved === 'dark' || saved === 'light'
                  ? saved
                  : (systemDark ? 'dark' : 'light');
                if (theme === 'dark') {
                  d.classList.add('dark');
                } else {
                  d.classList.remove('dark');
                }
                // rAF: se alinea con el pr\u00f3ximo paint, no con el event loop
                requestAnimationFrame(function() {
                  d.classList.remove('no-transition');
                });
              } catch(e) {}
            `,
          }}
        />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/logo-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${montserrat.variable}font-sans antialiased bg-[var(--hp-bg-page)] text-[var(--hp-text-primary)]`}
      >
        <AnalyticsTracker />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <IntentResolver />
              <div className="flex flex-col min-h-screen">
                <a href="#main-content" className='sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-hp-action-primary text-white rounded-xl shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hp-action-primary'>
                  Saltar al contenido
                </a>
                <Header />
                <main id="main-content" className="flex-1 pb-20 md:pb-0">{children}</main>
                <Footer />
              </div>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
