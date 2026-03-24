// =============================================================================
// robots.ts — Generador de robots.txt dinámico
// Next.js App Router route que retorna el archivo robots.txt
// =============================================================================

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/site';

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
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
