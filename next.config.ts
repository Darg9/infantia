import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ===========================================================================
  // Security Headers
  // Aplican a todas las rutas de la aplicación
  // ===========================================================================
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Evita que el navegador "adivine" el Content-Type
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Prohíbe que la app sea embebida en iframes (clickjacking)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Fuerza HTTPS por 1 año (incluye subdominios)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Controla info enviada en el Referer header
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Limita acceso a APIs del navegador (geolocation, camera, etc.)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          // Content Security Policy básico
          // unsafe-inline requerido para Tailwind CSS v4 (genera estilos inline)
          // unsafe-eval requerido para Next.js dev mode y Leaflet
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + inline (Tailwind) + eval (Next.js/Leaflet)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Estilos: self + inline (Tailwind v4)
              "style-src 'self' 'unsafe-inline'",
              // Imágenes: self + data URIs + HTTPS externas (og:image de fuentes)
              "img-src 'self' data: https:",
              // Fuentes: solo self
              "font-src 'self'",
              // Conectividad: self + Supabase + Nominatim + Resend
              "connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org",
              // Tiles de mapa (Leaflet / OpenStreetMap)
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

export default nextConfig;
