// =============================================================================
// Tests: src/lib/date-label-utils.ts
// Función pura — sin I/O. Se inyecta `now` para evitar dependencia de reloj.
// Timezone de referencia: Colombia = UTC-5 (sin DST).
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getEditorialDateLabel } from '../date-label-utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Construye un Date para una fecha/hora Colombia local (COT = UTC-5).
 * Ejemplo: cotDate(2026, 5, 19, 0, 0) → medianoche COT = 2026-05-19T05:00:00Z
 *          cotDate(2026, 5, 19, 15, 0) → 3 PM COT     = 2026-05-19T20:00:00Z
 */
function cotDate(year: number, month: number, day: number, cotHours = 0, cotMinutes = 0): Date {
  const utcHours = cotHours + 5; // COT = UTC-5 → UTC = COT + 5
  return new Date(Date.UTC(year, month - 1, day, utcHours, cotMinutes));
}

/**
 * Referencia fija: martes 19 de mayo de 2026 a las 10:00 AM COT.
 * (2026-05-19 es martes — se verifica con: new Date('2026-05-19').getDay() === 2)
 */
const NOW = new Date('2026-05-19T15:00:00Z'); // 10:00 AM COT

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getEditorialDateLabel', () => {

  // ── Sin fecha ─────────────────────────────────────────────────────────────────
  describe('sin startDate', () => {
    it('retorna null cuando no hay fecha ni schedule', () => {
      expect(getEditorialDateLabel({ startDate: null }, NOW)).toBeNull();
    });

    it('retorna null para type RECURRING sin schedule', () => {
      expect(getEditorialDateLabel({ type: 'RECURRING', schedule: null }, NOW)).toBeNull();
    });

    it('retorna "Fines de semana" para schedule con sat+sun', () => {
      const sch = { days: ['sat', 'sun'], start: '10:00' };
      expect(getEditorialDateLabel({ type: 'RECURRING', schedule: sch }, NOW)).toBe('Fines de semana');
    });

    it('retorna "Lun–Vie" para schedule de días hábiles completos', () => {
      const sch = { days: ['mon', 'tue', 'wed', 'thu', 'fri'] };
      expect(getEditorialDateLabel({ type: 'RECURRING', schedule: sch }, NOW)).toBe('Lun–Vie');
    });

    it('retorna días abreviados para schedule parcial (mar + jue)', () => {
      const sch = { days: ['tue', 'thu'] };
      const label = getEditorialDateLabel({ type: 'RECURRING', schedule: sch }, NOW);
      expect(label).toBe('Mar · Jue');
    });

    it('retorna null para type ONE_TIME sin fecha aunque tenga schedule', () => {
      const sch = { days: ['sat'] };
      expect(getEditorialDateLabel({ type: 'ONE_TIME', schedule: sch }, NOW)).toBeNull();
    });
  });

  // ── Hoy ───────────────────────────────────────────────────────────────────────
  describe('startDate = hoy', () => {
    it('retorna "Hoy" cuando es medianoche COT (sin hora)', () => {
      // 19 mayo medianoche COT = cotDate(2026, 5, 19, 0) = 2026-05-19T05:00:00Z
      const start = cotDate(2026, 5, 19, 0);
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Hoy');
    });

    it('retorna "Hoy · 3 PM" cuando el evento es a las 3 PM COT', () => {
      const start = cotDate(2026, 5, 19, 15); // 3 PM COT = 20:00 UTC
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Hoy · 3 PM');
    });

    it('retorna "Hoy · 10:30 AM" con minutos específicos', () => {
      const start = cotDate(2026, 5, 19, 10, 30); // 10:30 AM COT = 15:30 UTC
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Hoy · 10:30 AM');
    });

    it('retorna "Hoy · 12 PM" para mediodía COT', () => {
      const start = cotDate(2026, 5, 19, 12); // noon COT = 17:00 UTC
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Hoy · 12 PM');
    });

    it('retorna "Hoy · 12:01 AM" para medianoche + 1 min', () => {
      // 12:01 AM COT = 05:01 UTC
      const start = new Date('2026-05-19T05:01:00Z');
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Hoy · 12:01 AM');
    });
  });

  // ── Mañana ────────────────────────────────────────────────────────────────────
  describe('startDate = mañana', () => {
    it('retorna "Mañana"', () => {
      const start = cotDate(2026, 5, 20, 0); // miércoles 20 mayo medianoche COT
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Mañana');
    });
  });

  // ── Esta semana (2–6 días) ────────────────────────────────────────────────────
  describe('startDate dentro de 7 días', () => {
    // NOW = martes 19 mayo 2026
    // 20 may = mié (mañana, cubierto arriba)
    // 21 may = jue (2 días)
    // 22 may = vie (3 días)
    // 23 may = sáb (4 días) → fin de semana
    // 24 may = dom (5 días) → fin de semana
    // 25 may = lun (6 días)

    it('retorna "Este fin de semana" para sábado dentro de 7 días', () => {
      const start = cotDate(2026, 5, 23, 0); // sábado 23 mayo
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Este fin de semana');
    });

    it('retorna "Este fin de semana" para domingo dentro de 7 días', () => {
      const start = cotDate(2026, 5, 24, 0); // domingo 24 mayo
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Este fin de semana');
    });

    it('retorna "Jue 21" para jueves próximo (2 días)', () => {
      const start = cotDate(2026, 5, 21, 0); // jueves 21 mayo
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Jue 21');
    });

    it('retorna "Vie 22" para viernes próximo (3 días)', () => {
      const start = cotDate(2026, 5, 22, 0); // viernes 22 mayo
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Vie 22');
    });

    it('retorna "Lun 25" para lunes (6 días)', () => {
      const start = cotDate(2026, 5, 25, 0); // lunes 25 mayo
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Lun 25');
    });
  });

  // ── Más de 7 días ─────────────────────────────────────────────────────────────
  describe('startDate > 7 días', () => {
    it('retorna rango "18–20 Ago" para evento multi-día mismo mes', () => {
      const start = cotDate(2030, 8, 18); // 18 ago medianoche COT
      const end   = cotDate(2030, 8, 20); // 20 ago
      expect(getEditorialDateLabel({ startDate: start, endDate: end }, NOW)).toBe('18–20 Ago');
    });

    it('retorna "18 Sep" para evento futuro sin rango', () => {
      const start = cotDate(2030, 9, 18);
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('18 Sep');
    });

    it('retorna "1 Ene" para primer día del año', () => {
      const start = cotDate(2031, 1, 1);
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('1 Ene');
    });

    it('retorna "31 Dic" para último día del año', () => {
      const start = cotDate(2030, 12, 31);
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('31 Dic');
    });

    it('retorna "D Mes" (no rango) cuando startDate y endDate son el mismo día', () => {
      const start = cotDate(2030, 9, 5, 0);  // medianoche
      const end   = cotDate(2030, 9, 5, 20); // 8 PM — mismo día
      expect(getEditorialDateLabel({ startDate: start, endDate: end }, NOW)).toBe('5 Sep');
    });
  });

  // ── Eventos pasados ────────────────────────────────────────────────────────────
  describe('startDate en el pasado', () => {
    it('retorna null para eventos ya pasados', () => {
      const past = cotDate(2020, 1, 1);
      expect(getEditorialDateLabel({ startDate: past }, NOW)).toBeNull();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('acepta startDate como Date nativo (no solo string)', () => {
      const start = cotDate(2026, 5, 19, 0); // medianoche COT hoy
      expect(getEditorialDateLabel({ startDate: start }, NOW)).toBe('Hoy');
    });

    it('acepta string ISO como startDate', () => {
      // 2026-05-19T05:00:00Z = medianoche COT del 19 mayo
      expect(getEditorialDateLabel({ startDate: '2026-05-19T05:00:00Z' }, NOW)).toBe('Hoy');
    });

    it('usa new Date() como now por defecto (no lanza)', () => {
      expect(() => getEditorialDateLabel({ startDate: null })).not.toThrow();
    });

    it('ignora schedule para actividades con startDate definido', () => {
      const sch = { days: ['sat', 'sun'] };
      const start = cotDate(2026, 5, 19, 0); // hoy
      // schedule existe pero startDate tiene prioridad
      expect(getEditorialDateLabel({ startDate: start, schedule: sch, type: 'RECURRING' }, NOW)).toBe('Hoy');
    });
  });
});
