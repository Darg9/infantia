import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // @react-pdf/renderer must run server-side only (uses Node.js APIs)
  serverExternalPackages: ['@react-pdf/renderer'],
  async redirects() {
    return [
      {
        source: '/tratamiento-datos',
        destination: '/centro-de-confianza/datos',
        permanent: true, // 308 redirect
      },
      {
        source: '/seguridad/:path*',
        destination: '/centro-de-confianza/:path*',
        permanent: true, // 308 redirect (301)
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

// Sentry solo activo si SENTRY_DSN está configurado
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // Silencia logs de Sentry CLI durante el build
      silent: true,
      // Desactiva source map upload (requiere SENTRY_AUTH_TOKEN separado)
      sourcemaps: { disable: true },
      // No inyectar Sentry en el bundle del cliente si no hay DSN público
      autoInstrumentServerFunctions: true,
    })
  : nextConfig;
