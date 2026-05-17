import { describe, it, expect } from 'vitest';
import { rankCandidates } from '../ranking';
import type { DiscoveredLink } from '../types';

// =============================================================================
// ranking.discovery.test.ts — Tests de scoring de URLs de discovery
//
// Fixtures: URLs reales identificadas en auditoría de mayo 2026.
// Cada test verifica que el score calculado sobre la URL sola (sin title/snippet,
// caso peor de sitemap XML) supera el umbral mínimo para entrar al Top-K.
//
// REGLA EMPÍRICA:
//   score ≥ 5 → entra con alta probabilidad (explotación 80%)
//   score ≥ 2 → entra por ε-greedy (exploración 20%, frágil)
//   score = 0 → NUNCA seleccionada (bug confirmado)
// =============================================================================

function link(url: string, title = '', snippet = ''): DiscoveredLink {
  return { url, title, snippet, anchorText: '' };
}

// ── Grupo A: Cinemateca — score era 0, ahora ≥ 2 con /pelicula en URL_EVENT_RE ─

describe('Cinemateca — /node/peliculas/ (era score 0, bug confirmado)', () => {
  it('cinematecadebogota.gov.co/node/peliculas/1269?sede=11 → score ≥ 2', () => {
    const url = 'https://cinematecadebogota.gov.co/node/peliculas/1269?sede=11';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(2);
  });

  it('cinematecadebogota.gov.co/node/peliculas/2093?sede=11 → score ≥ 2', () => {
    const url = 'https://cinematecadebogota.gov.co/node/peliculas/2093?sede=11';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(2);
  });

  it('score anterior (URL_EVENT_RE sin /pelicula) era 0 — verificar regresión', () => {
    // Si este test falla en el futuro, significa que alguien removió /pelicula de URL_EVENT_RE
    const url = 'https://cinematecadebogota.gov.co/node/peliculas/1269?sede=11';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThan(0); // nunca más score 0
  });
});

// ── Grupo B: Bogotá.gov — ballet/muestra eran score 2, ahora ≥ 5 con EVENT_RE ─

describe('Bogotá.gov — términos culturales nuevos en EVENT_RE', () => {
  it('planes-bogota-ballet-carmina-burana (teatro+ballet → +3) → score ≥ 5', () => {
    const url = 'https://bogota.gov.co/que-hacer/cultura/planes-bogota-ballet-carmina-burana-en-teatro-gaitan-21-de-mayo-2026';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(5);
    expect(rankedPool[0].signals['hasEventWord']).toBe(3);
    expect(rankedPool[0].signals['urlPattern']).toBe(2);
  });

  it('planes-muestra-virgilio-barco (muestra → +3) → score ≥ 5', () => {
    const url = 'https://bogota.gov.co/que-hacer/cultura/planes-en-bogota-muestra-virgilio-barco-en-biblored-desde-20-marzo';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(5);
    expect(rankedPool[0].signals['hasEventWord']).toBe(3);
  });

  it('planes-concierto-bunbury (concierto ya funcionaba) → score ≥ 5', () => {
    const url = 'https://bogota.gov.co/que-hacer/cultura/planes-bogota-concierto-enrique-bunbury-bogota-octubre-29-de-2026';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(5);
  });
});

// ── Grupo C: Idartes — /agenda/ ya funcionaba, verificar regresión ──────────

describe('Idartes — /agenda/ (ya funcionaba, test de regresión)', () => {
  it('idartes/agenda/concierto/santaolalla → score ≥ 5', () => {
    const url = 'https://www.idartes.gov.co/es/agenda/concierto/gustavo-santaolalla-llega-bogota-con-el-ronroco-tour';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(5);
  });

  it('idartes/agenda/encuentro/narrativas → score ≥ 5', () => {
    const url = 'https://www.idartes.gov.co/es/agenda/encuentro/6402-narrativas-espaciales-de-la-memoria-del-dato-al-memorial-digital';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(5);
  });
});

// ── Grupo D: BibloRed — /programate/ sigue en 2, documentado ────────────────

describe('BibloRed — /programate/ sin keywords explícitas (score limitado por URL)', () => {
  it('programate/circulo-de-mujeres → score ≥ 2 (solo URL_EVENT_RE, sin event word)', () => {
    const url = 'https://www.biblored.gov.co/programate/circulo-de-mujeres-entre-puntadas-y-heridas';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(2);
    // Si el sitemap proporciona title con fecha/taller/etc → score sube. Sin title: 2.
    expect(rankedPool[0].signals['urlPattern']).toBe(2);
  });

  it('con title que incluya evento → score sube a ≥ 5', () => {
    const url = 'https://www.biblored.gov.co/programate/circulo-de-mujeres-entre-puntadas-y-heridas';
    const title = 'Taller: Círculo de mujeres entre puntadas y heridas — 15 de mayo 2026';
    const { rankedPool } = rankCandidates([link(url, title)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(5);
  });
});

// ── URL_DATE_RE — señal de URL con fecha explícita (/año/mes/ o /año-mes-día/) ─

describe('URL_DATE_RE — URLs con fecha en path (+2 score)', () => {
  it('URL con patrón /año/mes/ activa URL_DATE_RE → signals.urlDate = 2', () => {
    const url = 'https://biblored.gov.co/noticias/2026/05/taller-literatura';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].signals['urlDate']).toBe(2);
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(2);
  });

  it('URL con patrón /año/mes/día/ también activa URL_DATE_RE', () => {
    const url = 'https://idartes.gov.co/noticias/2026/05/15/exposicion-arte-digital';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].signals['urlDate']).toBe(2);
  });

  it('URL con patrón /año-mes-día/ (ISO en path) activa URL_DATE_RE', () => {
    const url = 'https://bogota.gov.co/eventos/2026-05-20/concierto-orquesta';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].signals['urlDate']).toBe(2);
  });

  it('URL sin patrón de fecha NO activa URL_DATE_RE', () => {
    const url = 'https://bogota.gov.co/que-hacer/cultura/taller-arte';
    const { rankedPool } = rankCandidates([link(url, 'taller')], { maxPagesLimit: 1 });
    expect(rankedPool[0].signals['urlDate']).toBeUndefined();
  });
});

// ── freshnessScore — bonus por lastmod reciente en sitemaps XML ──────────────

describe('freshnessScore — bonus por lastmod reciente (+1 o +2)', () => {
  function linkWithLastmod(url: string, lastmod: string): import('../types').DiscoveredLink {
    return { url, title: '', snippet: '', anchorText: '', lastmod };
  }

  it('lastmod hace ≤7 días → freshness = +2 (señal muy fresca)', () => {
    const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { rankedPool } = rankCandidates(
      [linkWithLastmod('https://biblored.gov.co/evento-reciente', recent)],
      { maxPagesLimit: 1 },
    );
    expect(rankedPool[0].signals['freshness']).toBe(2);
  });

  it('lastmod hace 15 días → freshness = +1 (fresco, no urgente)', () => {
    const medium = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const { rankedPool } = rankCandidates(
      [linkWithLastmod('https://biblored.gov.co/evento-medio', medium)],
      { maxPagesLimit: 1 },
    );
    expect(rankedPool[0].signals['freshness']).toBe(1);
  });

  it('lastmod hace >30 días → sin bonus de freshness', () => {
    const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const { rankedPool } = rankCandidates(
      [linkWithLastmod('https://biblored.gov.co/evento-viejo', old)],
      { maxPagesLimit: 1 },
    );
    expect(rankedPool[0].signals['freshness']).toBeUndefined();
  });

  it('sin lastmod → sin bonus de freshness', () => {
    const { rankedPool } = rankCandidates(
      [link('https://biblored.gov.co/evento-sin-lastmod')],
      { maxPagesLimit: 1 },
    );
    expect(rankedPool[0].signals['freshness']).toBeUndefined();
  });
});

// ── v3: /actividades/ plural en URL_EVENT_RE ─────────────────────────────────

describe('v3 — URL_EVENT_RE con /actividades/ plural (Maloka y similares)', () => {
  it('maloka.org/actividades/tiburockcito → score ≥ 2 gracias a /actividades/', () => {
    const url = 'https://maloka.org/actividades/tiburockcito-canciones-y-juegos-para-descubrir-el-mar';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(2);
    expect(rankedPool[0].signals['urlPattern']).toBe(2);
  });

  it('/actividad/ (singular) sigue funcionando sin regresión', () => {
    const url = 'https://banrepcultural.org/bogota/actividad/visita-guiada-exposicion';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(2);
    expect(rankedPool[0].signals['urlPattern']).toBe(2);
  });
});

// ── v3: NEG_URL_RE para rutas institucionales ─────────────────────────────────

describe('v3 — NEG_URL_RE para rutas institucionales (banrepcultural, jbb)', () => {
  it('/colecciones/ en path → signals.negativeUrl = -2', () => {
    const url = 'https://banrepcultural.org/colecciones/arte-colombiano';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].signals['negativeUrl']).toBe(-2);
    expect(rankedPool[0].score).toBeLessThanOrEqual(1);
  });

  it('/autoformacion/ en path → signals.negativeUrl = -2', () => {
    const url = 'https://banrepcultural.org/autoformacion/historia-colonial';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].signals['negativeUrl']).toBe(-2);
  });

  it('/transparencia/ en path → signals.negativeUrl = -2', () => {
    const url = 'https://jbb.gov.co/transparencia/planes-informes';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].signals['negativeUrl']).toBe(-2);
  });

  it('/biblioteca-luis-angel-arango/ en path → signals.negativeUrl = -2', () => {
    const url = 'https://banrepcultural.org/bogota/biblioteca-luis-angel-arango/actividades';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    // Aunque contiene "actividades", el prefijo biblioteca-* neutraliza
    expect(rankedPool[0].signals['negativeUrl']).toBe(-2);
  });

  it('URL de evento real en banrepcultural NO activa NEG_URL_RE', () => {
    const url = 'https://banrepcultural.org/bogota/actividad/concierto-jazz-bogota';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    expect(rankedPool[0].signals['negativeUrl']).toBeUndefined();
    expect(rankedPool[0].score).toBeGreaterThanOrEqual(2);
  });
});

// ── v3: ε adaptativo según zeroScorePct ──────────────────────────────────────

describe('v3 — ε adaptativo (zeroScorePct > 70% → ε reducido a 0.05)', () => {
  it('fuente con muchas URLs de score 0 → epsilon = 0.05', () => {
    // 20 URLs con score 0 (rutas institucionales sin palabras clave)
    const badLinks = Array.from({ length: 20 }, (_, i) =>
      link(`https://banrepcultural.org/colecciones/item-${i}`),
    );
    const { epsilon, zeroScorePct } = rankCandidates(badLinks, { maxPagesLimit: 10 });
    expect(zeroScorePct).toBeGreaterThan(70);
    expect(epsilon).toBe(0.05);
  });

  it('fuente normal (zeroScorePct ≤ 70%) → epsilon = 0.20', () => {
    // Mayoría de URLs con signal positivo (idartes style)
    const goodLinks = Array.from({ length: 10 }, (_, i) =>
      link(`https://idartes.gov.co/es/agenda/concierto/evento-${i}`),
    );
    const { epsilon, zeroScorePct } = rankCandidates(goodLinks, { maxPagesLimit: 5 });
    expect(zeroScorePct).toBeLessThanOrEqual(70);
    expect(epsilon).toBe(0.2);
  });
});

// ── Falsos positivos — palabras nuevas no deben disparar en páginas estáticas ─

describe('Regresión — palabras nuevas no deben romper páginas estáticas', () => {
  it('página de política de privacidad con "teatro" en nombre → NEG_RE neutraliza', () => {
    const url = 'https://teatronacional.gov.co/politica-privacidad';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    // "privacidad" en NEG_RE → -2. "teatro" en EVENT_RE → +3. Net: 1. Aceptable.
    expect(rankedPool[0].score).toBeLessThan(5);
  });

  it('sitio institucional con "cine" en dominio pero ruta estática → sin URL_EVENT_RE', () => {
    // "cine" en "cinemateca" NO hace match por \b word boundary (sigue "mateca")
    const url = 'https://cinematecadebogota.gov.co/quienes-somos';
    const { rankedPool } = rankCandidates([link(url)], { maxPagesLimit: 1 });
    // "quienes-somos" → NEG_RE (quienes somos) → -2. Net: ≤ 1.
    expect(rankedPool[0].score).toBeLessThanOrEqual(1);
  });
});
