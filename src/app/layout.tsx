import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'HabitaPlan',
    title: 'HabitaPlan — Actividades para niños en Colombia',
    description:
      'Descubre talleres, clubes, campamentos y eventos para niños y familias en Colombia.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HabitaPlan — Actividades para niños en Colombia',
    description:
      'Descubre talleres, clubes, campamentos y eventos para niños y familias en Colombia.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
