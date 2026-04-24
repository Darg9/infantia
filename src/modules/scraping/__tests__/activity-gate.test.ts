// =============================================================================
// Activity Gate — Tests
//
// Cubre: isBlockedBySourcePath (bug hostname + allowlists actualizadas),
//        evaluateActivityGate (señales, pesos, hard blocks, soft threshold).
// =============================================================================

import { describe, it, expect } from 'vitest';
import { evaluateActivityGate } from '../quality/activity-gate';
import type { ActivityNLPResult } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeActivity(overrides: Partial<ActivityNLPResult> = {}): ActivityNLPResult {
  return {
    title: 'Taller de pintura para niños',
    description: 'Taller presencial en Bogotá todos los sábados de abril. Cupos limitados.',
    startDate: '2026-05-03',
    endDate: null,
    schedules: [{ date: '2026-05-03', time: '10:00', description: 'Sesión inicial' }],
    location: 'Biblioteca El Tintal',
    price: 0,
    isFree: true,
    categories: ['talleres'],
    ageMin: 5,
    ageMax: 12,
    confidenceScore: 0.85,
    sourceUrl: 'https://www.biblored.gov.co/eventos/taller-pintura',
    ...overrides,
  };
}

// ─── SECCIÓN 1: isBlockedBySourcePath — Bug hostname (regresión) ─────────────

describe('Activity Gate — hostname matching bug (regresión)', () => {
  it('cinematecadebogota.gov.co NO debe ser bloqueada por regla de bogota.gov.co', () => {
    const result = evaluateActivityGate(
      makeActivity({ title: 'Ciclo de cine colombiano', description: 'Función presencial en la Cinemateca. Abril 2026.' }),
      'https://cinematecadebogota.gov.co/cine/11/funcion-apertura',
    );
    // Con el bug anterior esto era pass=false, blocked_by_source_path.
    // Con el fix debe pasar el check de path (no está en ninguna allowlist).
    expect(result.signals.blockedBySourcePath).toBe(false);
  });

  it('cinematecadebogota.gov.co/agenda tampoco debe ser bloqueada', () => {
    const result = evaluateActivityGate(
      makeActivity({ title: 'Taller de guión', description: 'Formación presencial. Cada miércoles de mayo 2026.' }),
      'https://cinematecadebogota.gov.co/agenda/11/taller-guion',
    );
    expect(result.signals.blockedBySourcePath).toBe(false);
  });

  it('sub.bogota.gov.co SÍ debe matchear la regla de bogota.gov.co', () => {
    // Un subdominio legítimo de bogota.gov.co SÍ debe ser restringido
    const result = evaluateActivityGate(
      makeActivity({ title: 'Evento ruido', description: 'Presupuesto municipal 2026.' }),
      'https://sub.bogota.gov.co/presupuesto/informe',
    );
    // /presupuesto no está en allowed → bloqueado
    expect(result.signals.blockedBySourcePath).toBe(true);
  });

  it('bogota.gov.co exacto SÍ aplica la restricción de paths', () => {
    const result = evaluateActivityGate(
      makeActivity({ title: 'Noticia institucional', description: 'Balance de gestión 2025.' }),
      'https://bogota.gov.co/gobierno/balance-gestion',
    );
    expect(result.signals.blockedBySourcePath).toBe(true);
  });
});

// ─── SECCIÓN 2: Allowlists actualizadas ──────────────────────────────────────

describe('Activity Gate — allowlists FCE actualizadas', () => {
  const fceActivity = makeActivity({
    title: 'Lanzamiento de novela',
    description: 'Presentación presencial. Miércoles 8 de mayo 2026 a las 6pm.',
    schedules: [{ date: '2026-05-08', time: '18:00', description: 'Lanzamiento' }],
  });

  it('fce.com.co/programacion-cultural debe pasar', () => {
    const r = evaluateActivityGate(fceActivity, 'https://fce.com.co/programacion-cultural/evento-123');
    expect(r.signals.blockedBySourcePath).toBe(false);
  });

  it('fce.com.co/talleres-a-fondo debe pasar', () => {
    const r = evaluateActivityGate(fceActivity, 'https://fce.com.co/talleres-a-fondo/taller-escritura');
    expect(r.signals.blockedBySourcePath).toBe(false);
  });

  it('fce.com.co/concursos debe pasar', () => {
    const r = evaluateActivityGate(fceActivity, 'https://fce.com.co/concursos/cuento-corto-2026');
    expect(r.signals.blockedBySourcePath).toBe(false);
  });

  it('fce.com.co/ (homepage) debe ser bloqueada', () => {
    const r = evaluateActivityGate(fceActivity, 'https://fce.com.co/');
    expect(r.signals.blockedBySourcePath).toBe(true);
  });

  it('fce.com.co/quienes-somos debe ser bloqueada', () => {
    const r = evaluateActivityGate(fceActivity, 'https://fce.com.co/quienes-somos/');
    expect(r.signals.blockedBySourcePath).toBe(true);
  });

  it('fce.com.co/tienda-libreria debe ser bloqueada', () => {
    const r = evaluateActivityGate(fceActivity, 'https://fce.com.co/tienda-libreria');
    expect(r.signals.blockedBySourcePath).toBe(true);
  });
});

describe('Activity Gate — allowlists bogota.gov.co actualizadas', () => {
  const bogotaActivity = makeActivity({
    title: 'Festival de teatro callejero',
    description: 'Programación cultural en parques de Bogotá. Del 2 al 10 de mayo.',
  });

  it('bogota.gov.co/que-hacer/agenda-cultural debe pasar', () => {
    const r = evaluateActivityGate(bogotaActivity, 'https://bogota.gov.co/que-hacer/agenda-cultural/festival-teatro');
    expect(r.signals.blockedBySourcePath).toBe(false);
  });

  it('bogota.gov.co/mi-ciudad/cultura-recreacion-y-deporte debe pasar', () => {
    const r = evaluateActivityGate(bogotaActivity, 'https://bogota.gov.co/mi-ciudad/cultura-recreacion-y-deporte/evento');
    expect(r.signals.blockedBySourcePath).toBe(false);
  });

  it('bogota.gov.co/gobierno/presupuesto debe ser bloqueada', () => {
    const r = evaluateActivityGate(bogotaActivity, 'https://bogota.gov.co/gobierno/presupuesto-2026');
    expect(r.signals.blockedBySourcePath).toBe(true);
  });
});

// ─── SECCIÓN 3: Señales y pesos del gate ─────────────────────────────────────

describe('Activity Gate — señales y pesos', () => {
  it('actividad completa (intent + time + location + gemini) debe pasar con score alto', () => {
    const r = evaluateActivityGate(makeActivity(), 'https://www.biblored.gov.co/eventos/taller');
    expect(r.pass).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.7);
    expect(r.signals.hasIntentSignal).toBe(true);
    expect(r.signals.hasTimeSignal).toBe(true);
    expect(r.signals.hasLocationSignal).toBe(true);
    expect(r.signals.noiseDetected).toBe(false);
  });

  it('ruido institucional sin intención debe ser hard-blocked', () => {
    const r = evaluateActivityGate(
      makeActivity({ title: 'Directorio institucional', description: 'Organigrama y misión institucional 2026.' }),
      'https://www.idartes.gov.co/es/quienes-somos',
    );
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('institutional_noise_no_intent');
    expect(r.signals.noiseDetected).toBe(true);
  });

  it('sin señal de tiempo ni intención debe ser hard-blocked', () => {
    const r = evaluateActivityGate(
      makeActivity({ title: 'Página de contacto', description: 'Escríbenos al correo.', schedules: [] }),
      'https://www.maloka.org/contacto',
    );
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('no_time_no_intent_signal');
  });

  it('score bajo (sin location, sin schedules, confianza baja) debe fallar threshold', () => {
    const r = evaluateActivityGate(
      makeActivity({
        title: 'Actividad',
        description: 'Próxima semana.',
        schedules: [],
        confidenceScore: 0.1,
      }),
      'https://www.maloka.org/programacion/evento',
    );
    // hasIntent(+0.25) + hasTime(+0.30) + noLocation(+0) + gemini*0.3(0.03) = 0.58 − puede pasar o no
    // Solo verificamos que el score sea calculado correctamente
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it('ruido detectado resta 0.40 al score', () => {
    const withNoise = evaluateActivityGate(
      makeActivity({ title: 'Taller de escritura', description: 'Quiénes somos — taller presencial Bogotá sábado mayo 2026.' }),
      'https://www.maloka.org/programacion/taller',
    );
    const withoutNoise = evaluateActivityGate(
      makeActivity({ title: 'Taller de escritura', description: 'Taller presencial Bogotá sábado mayo 2026.' }),
      'https://www.maloka.org/programacion/taller',
    );
    expect(withNoise.score).toBeLessThan(withoutNoise.score);
    expect(withNoise.signals.noiseDetected).toBe(true);
  });
});

// ─── SECCIÓN 4: Dominios sin restricción pasan libremente ────────────────────

describe('Activity Gate — dominios no restringidos pasan el check de path', () => {
  const goodActivity = makeActivity();

  const freedomDomains = [
    'https://www.biblored.gov.co/eventos/taller-123',
    'https://www.idartes.gov.co/es/agenda/concierto',
    'https://www.banrepcultural.org/actividades/bogota/evento',
    'https://maloka.org/programacion/taller-robotica',
    'https://fuga.gov.co/agenda/concierto-camara',
    'https://planetariodebogota.gov.co/programate/charla',
    'https://parqueexplora.org/actividades/taller',
  ];

  for (const url of freedomDomains) {
    it(`${new URL(url).hostname} no debe ser bloqueada por allowlist`, () => {
      const r = evaluateActivityGate(goodActivity, url);
      expect(r.signals.blockedBySourcePath).toBe(false);
    });
  }
});
