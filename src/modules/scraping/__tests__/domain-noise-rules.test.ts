import { describe, it, expect } from 'vitest';
import { isDomainSpecificNoise } from '../quality/domain-noise-rules';

describe('isDomainSpecificNoise', () => {
  // ── Global keyword check ────────────────────────────────────────────────────
  describe('GLOBAL_NOISE_REGEX (título)', () => {
    it('rechaza títulos con "pqrs"', () => {
      expect(isDomainSpecificNoise('https://example.com/algo', 'Formulario PQRS')).toBe(true);
    });
    it('rechaza títulos con "política de privacidad"', () => {
      expect(isDomainSpecificNoise('https://example.com', 'Política de privacidad')).toBe(true);
    });
    it('rechaza títulos con "habeas data"', () => {
      expect(isDomainSpecificNoise('https://example.com', 'Habeas Data — Formulario')).toBe(true);
    });
    it('no rechaza títulos de eventos normales', () => {
      expect(isDomainSpecificNoise('https://example.com/evento', 'Concierto de Jazz en el Parque')).toBe(false);
    });
  });

  // ── fce.com.co ──────────────────────────────────────────────────────────────
  describe('fce.com.co', () => {
    it('rechaza /producto/', () => {
      expect(isDomainSpecificNoise('https://www.fce.com.co/producto/libro-abc', 'Libro ABC')).toBe(true);
    });
    it('rechaza /checkout', () => {
      expect(isDomainSpecificNoise('https://www.fce.com.co/checkout', 'Checkout')).toBe(true);
    });
    it('no rechaza páginas de eventos FCE', () => {
      expect(isDomainSpecificNoise('https://www.fce.com.co/evento/presentacion-libro', 'Presentación de libro')).toBe(false);
    });
  });

  // ── bogota.gov.co ───────────────────────────────────────────────────────────
  describe('bogota.gov.co', () => {
    it('rechaza /tramites/', () => {
      expect(isDomainSpecificNoise('https://bogota.gov.co/tramites/licencias', 'Licencias')).toBe(true);
    });
    it('rechaza /transparencia', () => {
      expect(isDomainSpecificNoise('https://bogota.gov.co/transparencia', 'Transparencia')).toBe(true);
    });
    it('no rechaza páginas de agenda', () => {
      expect(isDomainSpecificNoise('https://bogota.gov.co/agenda/festival-vallenato', 'Festival')).toBe(false);
    });
  });

  // ── culturarecreacionydeporte.gov.co ────────────────────────────────────────
  describe('culturarecreacionydeporte.gov.co', () => {
    const base = 'https://www.culturarecreacionydeporte.gov.co';

    it('rechaza /transparencia', () => {
      expect(isDomainSpecificNoise(`${base}/es/transparencia-acceso-informacion-publica`, 'Transparencia')).toBe(true);
    });
    it('rechaza /la-secretaria', () => {
      expect(isDomainSpecificNoise(`${base}/es/la-secretaria-de-cultura`, 'La Secretaría')).toBe(true);
    });
    it('rechaza /oficina-juridica', () => {
      expect(isDomainSpecificNoise(`${base}/es/oficina-juridica-secretaria`, 'Oficina Jurídica')).toBe(true);
    });
    it('rechaza /plan-de-cultura', () => {
      expect(isDomainSpecificNoise(`${base}/es/plan-de-cultura-de-bogota-2038`, 'Plan de Cultura')).toBe(true);
    });
    it('rechaza /politica-de', () => {
      expect(isDomainSpecificNoise(`${base}/es/politica-de-derechos-de-autor`, 'Política de derechos')).toBe(true);
    });
    it('rechaza /ultimas-convocatorias', () => {
      expect(isDomainSpecificNoise(`${base}/es/ultimas-convocatorias`, 'Convocatorias')).toBe(true);
    });
    it('rechaza /podcast', () => {
      expect(isDomainSpecificNoise(`${base}/es/podcast`, 'Podcast SCRD')).toBe(true);
    });
    it('rechaza /sitemap', () => {
      expect(isDomainSpecificNoise(`${base}/sitemap`, 'Sitemap')).toBe(true);
    });

    // Rutas de eventos que NO deben rechazarse
    it('NO rechaza /es/eventos/nombre-evento', () => {
      expect(isDomainSpecificNoise(`${base}/es/eventos/concierto-de-jazz`, 'Concierto de Jazz')).toBe(false);
    });
    it('NO rechaza /es/agenda', () => {
      expect(isDomainSpecificNoise(`${base}/es/agenda`, 'Agenda cultural')).toBe(false);
    });
    it('NO rechaza /es/centro-felicidad-chapinero/eventos/capoeira', () => {
      expect(isDomainSpecificNoise(`${base}/es/centro-felicidad-chapinero/eventos/clases-de-capoeira`, 'Clases de Capoeira')).toBe(false);
    });
  });

  // ── Dominio desconocido (sin reglas) ────────────────────────────────────────
  describe('dominio sin reglas', () => {
    it('no rechaza URLs de dominio desconocido con título normal', () => {
      expect(isDomainSpecificNoise('https://random-site.com/eventos/festival', 'Festival de verano')).toBe(false);
    });
  });
});
