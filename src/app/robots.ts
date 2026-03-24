// =============================================================================
// robots.ts — Generador de robots.txt dinámico
// Next.js App Router route que retorna el archivo robots.txt
// =============================================================================

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/auth/', '/login', '/registro', '/perfil/'],
        crawlDelay: 1,
      },
    ],
    sitemap: 'https://infantia.app/sitemap.xml',
  };
}
