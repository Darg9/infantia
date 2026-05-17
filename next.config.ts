import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false, // genera el archivo pero no abre el browser automáticamente
});

const nextConfig: NextConfig = {
  // @react-pdf/renderer must run server-side only (uses Node.js APIs)
  serverExternalPackages: ['@react-pdf/renderer'],

  // Optimización de imágenes externas (Supabase Storage + dominios de scraping).
  // hostname '**' necesario: imágenes vienen de decenas de dominios distintos.
  // Restringir a dominios específicos cuando el catálogo de fuentes sea estable.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  async redirects() {
    return [
      // ── Rutas legacy → Centro de Confianza hub ──────────────────────────────
      // /privacidad y /terminos consolidadas bajo /centro-de-confianza/*
      // 301 permanente: Google transfiere autoridad al destino y actualiza índice.
      {
        source: '/privacidad',
        destination: '/centro-de-confianza/privacidad',
        permanent: true,
      },
      {
        source: '/terminos',
        destination: '/centro-de-confianza/terminos',
        permanent: true,
      },
      // ── Redirects anteriores ─────────────────────────────────────────────────
      {
        source: '/tratamiento-datos',
        destination: '/centro-de-confianza/datos',
        permanent: true,
      },
      {
        source: '/seguridad/:path*',
        destination: '/centro-de-confianza/:path*',
        permanent: true,
      },
      {
        source: '/seguridad',
        destination: '/centro-de-confianza',
        permanent: true,
      },
    ];
  },
  // ===========================================================================
  // Security Headers — aplican a todas las rutas
  // ===========================================================================
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Evita que el navegador "adivine" el Content-Type
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Prohíbe embebido en iframes (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Fuerza HTTPS por 1 año
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Controla info enviada en Referer header
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Limita APIs del navegador
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()" },
          // CSP básico — unsafe-inline requerido por Tailwind v4, unsafe-eval por Next.js/Leaflet
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org https://*.sentry.io",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// Pipeline: bundleAnalyzer → (Sentry si hay DSN)
const configWithAnalyzer = withBundleAnalyzer(nextConfig);

export default process.env.SENTRY_DSN
  ? withSentryConfig(configWithAnalyzer, {
      silent: true,
      sourcemaps: { disable: true },
      autoInstrumentServerFunctions: true,
    })
  : configWithAnalyzer;
