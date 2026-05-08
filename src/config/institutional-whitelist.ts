// =============================================================================
// Whitelist Institucional — Pipeline V2
//
// Dominios de entidades públicas o altamente confiables cuya programación
// cultural/familiar es verificable y de alto valor editorial.
//
// Efecto en el Pipeline V2:
//   - Umbral del gate diferenciado (más permisivo que fuentes desconocidas)
//   - Score bajo → PENDING_REVIEW (no DROP)
//   - isActivity:false → siempre DROP (Gemini fue explícito)
//
// Fuentes con scraper activo están marcadas con ✅
// Fuentes en whitelist sin scraper activo están marcadas con 🔜 (whitelist ready)
// =============================================================================

export interface InstitutionalSource {
  domain: string;
  name: string;
  city: string;
  hasActiveScraper: boolean;
}

export const INSTITUTIONAL_WHITELIST: InstitutionalSource[] = [
  // ── Bogotá — Entidades distritales ────────────────────────────────────────
  { domain: 'biblored.gov.co',             name: 'BibloRed',                    city: 'Bogotá',   hasActiveScraper: true  }, // ✅
  { domain: 'idartes.gov.co',              name: 'Idartes',                     city: 'Bogotá',   hasActiveScraper: true  }, // ✅
  { domain: 'planetariodebogota.gov.co',   name: 'Planetario de Bogotá',        city: 'Bogotá',   hasActiveScraper: true  }, // ✅
  { domain: 'bogota.gov.co',               name: 'Alcaldía de Bogotá',          city: 'Bogotá',   hasActiveScraper: true  }, // ✅
  { domain: 'cinematecadebogota.gov.co',   name: 'Cinemateca de Bogotá',        city: 'Bogotá',   hasActiveScraper: true  }, // ✅
  { domain: 'culturarecreacionydeporte.gov.co', name: 'Sec. Cultura Bogotá',   city: 'Bogotá',   hasActiveScraper: true  }, // ✅
  { domain: 'jbb.gov.co',                  name: 'Jardín Botánico de Bogotá',   city: 'Bogotá',   hasActiveScraper: true  }, // ✅
  { domain: 'fuga.gov.co',                 name: 'FUGA Filarmónica',            city: 'Bogotá',   hasActiveScraper: true  }, // ✅

  // ── Bogotá — Entidades nacionales / culturales ─────────────────────────────
  { domain: 'banrepcultural.org',          name: 'Banco de la República',       city: 'Bogotá',   hasActiveScraper: true  }, // ✅
  { domain: 'fce.com.co',                  name: 'Fondo de Cultura Económica',  city: 'Bogotá',   hasActiveScraper: true  }, // ✅
  { domain: 'maloka.org',                  name: 'Maloka',                      city: 'Bogotá',   hasActiveScraper: false }, // 🔜
  { domain: 'museonacional.gov.co',        name: 'Museo Nacional de Colombia',  city: 'Bogotá',   hasActiveScraper: false }, // 🔜
  { domain: 'teatromayor.unal.edu.co',     name: 'Teatro Mayor Julio Mario',    city: 'Bogotá',   hasActiveScraper: false }, // 🔜

  // ── Medellín ───────────────────────────────────────────────────────────────
  { domain: 'parqueexplora.org',           name: 'Parque Explora',              city: 'Medellín', hasActiveScraper: true  }, // ✅

  // ── Cajas de compensación (multi-ciudad, alta confiabilidad) ──────────────
  { domain: 'compensar.com',               name: 'Compensar',                   city: 'Bogotá',   hasActiveScraper: false }, // 🔜
  { domain: 'colsubsidio.com',             name: 'Colsubsidio',                 city: 'Bogotá',   hasActiveScraper: false }, // 🔜
  { domain: 'cafam.com.co',                name: 'Cafam',                       city: 'Bogotá',   hasActiveScraper: false }, // 🔜
];

// Set de dominios para lookup O(1)
export const INSTITUTIONAL_DOMAINS = new Set(
  INSTITUTIONAL_WHITELIST.map((s) => s.domain),
);

/**
 * Verifica si un hostname pertenece a la whitelist institucional.
 * Soporta subdominio (sub.idartes.gov.co → idartes.gov.co).
 */
export function isInstitutionalSource(urlOrHostname: string): boolean {
  let hostname = urlOrHostname;
  try {
    hostname = new URL(urlOrHostname).hostname;
  } catch {
    // ya es un hostname
  }
  hostname = hostname.replace(/^www\./, '');

  if (INSTITUTIONAL_DOMAINS.has(hostname)) return true;
  // subdominio: agenda.biblored.gov.co → biblored.gov.co
  for (const domain of INSTITUTIONAL_DOMAINS) {
    if (hostname.endsWith('.' + domain)) return true;
  }
  return false;
}

/**
 * Retorna el nombre legible de la fuente institucional, o null si no es whitelist.
 */
export function getInstitutionalName(urlOrHostname: string): string | null {
  let hostname = urlOrHostname;
  try {
    hostname = new URL(urlOrHostname).hostname;
  } catch { /* ya es hostname */ }
  hostname = hostname.replace(/^www\./, '');

  const entry = INSTITUTIONAL_WHITELIST.find(
    (s) => hostname === s.domain || hostname.endsWith('.' + s.domain),
  );
  return entry?.name ?? null;
}
