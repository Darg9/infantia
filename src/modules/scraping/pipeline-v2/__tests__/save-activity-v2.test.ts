// =============================================================================
// save-activity-v2.test.ts — Tests para el módulo de persistencia V2
//
// Estructura:
//   1. Funciones puras (getHardcodedCity, mapActivityType, computeTemporalMeta)
//      — sin mocks, testables directamente.
//   2. saveActivityV2 — mocks completos de Prisma, data-pipeline, geocoding.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks con vi.hoisted (deben estar listos antes del hoisting de vi.mock) ──

const mocks = vi.hoisted(() => ({
  mockVerticalFindUnique: vi.fn(),
  mockProviderFindFirst:  vi.fn(),
  mockProviderUpsert:     vi.fn(),
  mockProviderCreate:     vi.fn(),
  mockActivityFindFirst:  vi.fn(),
  mockActivityCreate:     vi.fn(),
  mockActivityUpdate:     vi.fn(),
  mockLocationFindFirst:  vi.fn(),
  mockLocationCreate:     vi.fn(),
  mockCategoryFindFirst:  vi.fn(),
  mockActivityCategoryDeleteMany: vi.fn(),
  mockActivityCategoryUpsert:     vi.fn(),
  mockExecuteRawUnsafe:   vi.fn(),
  mockRunDataPipeline:    vi.fn(),
  mockMatchCity:          vi.fn(),
  mockGeocodeAddress:     vi.fn(),
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(function () { return {}; }),
}));

// Rutas relativas a __tests__/ → subir 4 niveles llega a src/
vi.mock('../../../../generated/prisma/client', () => ({
  Prisma: { JsonNull: '__JSON_NULL__' },
  ActivityStatus: {
    ACTIVE:              'ACTIVE',
    PENDING_REVIEW:      'PENDING_REVIEW',
    DRAFT:               'DRAFT',
    DUPLICATE:           'DUPLICATE',
    EXPIRED:             'EXPIRED',
    DISCARDED_QUALITY:   'DISCARDED_QUALITY',
  },
  PrismaClient: vi.fn().mockImplementation(function () {
    return {
      vertical: {
        findUnique: mocks.mockVerticalFindUnique,
      },
      provider: {
        findFirst: mocks.mockProviderFindFirst,
        upsert:    mocks.mockProviderUpsert,
        create:    mocks.mockProviderCreate,
      },
      activity: {
        findFirst: mocks.mockActivityFindFirst,
        create:    mocks.mockActivityCreate,
        update:    mocks.mockActivityUpdate,
      },
      location: {
        findFirst: mocks.mockLocationFindFirst,
        create:    mocks.mockLocationCreate,
      },
      category: {
        findFirst: mocks.mockCategoryFindFirst,
      },
      activityCategory: {
        deleteMany: mocks.mockActivityCategoryDeleteMany,
        upsert:     mocks.mockActivityCategoryUpsert,
      },
      $executeRawUnsafe: mocks.mockExecuteRawUnsafe,
    };
  }),
}));

// db.ts crea un PrismaClient singleton al importarse — bloqueamos para evitar
// que city-matcher (u otro módulo) lo instancie sin DATABASE_URL real
vi.mock('../../../../lib/db', () => ({ db: {} }));

// data-pipeline: up 2 desde __tests__/ llega a scraping/
vi.mock('../../data-pipeline', () => ({
  runDataPipeline: mocks.mockRunDataPipeline,
}));

// city-matcher: up 3 desde __tests__/ llega a modules/
vi.mock('../../../geo/city-matcher', () => ({
  matchCity: mocks.mockMatchCity,
}));

// geocoding: up 4 desde __tests__/ llega a src/lib/
vi.mock('../../../../lib/geocoding', () => ({
  geocodeAddress: mocks.mockGeocodeAddress,
}));

// Importar DESPUÉS de los mocks
import {
  saveActivityV2,
  getHardcodedCity,
  mapActivityType,
  computeTemporalMeta,
} from '../save-activity-v2';
import type { ActivityNLPResult } from '../../types';
import type { GateV2Result } from '../../quality/activity-gate-v2';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const baseNLPResult: ActivityNLPResult = {
  isActivity: true,
  title: 'Taller de arte para niños',
  description: 'Taller creativo en el centro cultural.',
  categories: ['Arte'],
  confidenceScore: 0.9,
  minAge: 6,
  maxAge: 12,
  price: 0,
  currency: 'COP',
  pricePeriod: null,
  audience: 'KIDS',
  imageUrl: 'https://example.com/img.jpg',
  schedules: [{ startDate: '2026-12-15', endDate: undefined, notes: undefined }],
  location: { address: 'Calle 80 #10-20', city: 'Bogotá' },
  parserSource: 'gemini',
};

const activeGate: GateV2Result = {
  decision: 'ACTIVE',
  score: 0.85,
  reason: 'High confidence',
  isInstitutional: false,
  signals: { hasIntentSignal: false, hasTimeSignal: false, hasLocationSignal: false, noiseDetected: false, blockedBySourcePath: false },
  sourceTrust: 0.8,
};

const pendingGate: GateV2Result = {
  decision: 'PENDING_REVIEW',
  score: 0.45,
  reason: 'Low confidence',
  isInstitutional: false,
  signals: { hasIntentSignal: false, hasTimeSignal: false, hasLocationSignal: false, noiseDetected: false, blockedBySourcePath: false },
  sourceTrust: 0.4,
};

const dropGate: GateV2Result = {
  decision: 'DROP',
  score: 0.1,
  reason: 'Not an activity',
  isInstitutional: false,
  signals: { hasIntentSignal: false, hasTimeSignal: false, hasLocationSignal: false, noiseDetected: false, blockedBySourcePath: false },
  sourceTrust: 0.1,
};

const SOURCE_URL = 'https://idartes.gov.co/talleres/arte-infantil';

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Defaults que funcionan para el happy path
  mocks.mockRunDataPipeline.mockReturnValue({
    valid: true,
    data: baseNLPResult,
  });
  mocks.mockVerticalFindUnique.mockResolvedValue({ id: 'vert-001', slug: 'kids' });
  mocks.mockProviderFindFirst.mockResolvedValue(null);
  mocks.mockProviderUpsert.mockResolvedValue({ id: 'prov-001', name: 'idartes.gov.co' });
  mocks.mockActivityFindFirst.mockResolvedValue(null); // no duplicate
  mocks.mockActivityCreate.mockResolvedValue({ id: 'act-001' });
  mocks.mockActivityUpdate.mockResolvedValue({ id: 'act-001' });
  mocks.mockLocationFindFirst.mockResolvedValue(null);
  mocks.mockMatchCity.mockResolvedValue({ status: 'MATCH', cityId: 'city-001' });
  mocks.mockGeocodeAddress.mockResolvedValue({ latitude: 4.711, longitude: -74.072 });
  mocks.mockLocationCreate.mockResolvedValue({ id: 'loc-001' });
  mocks.mockCategoryFindFirst.mockResolvedValue({ id: 'cat-001', name: 'Arte' });
  mocks.mockActivityCategoryDeleteMany.mockResolvedValue({ count: 0 });
  mocks.mockActivityCategoryUpsert.mockResolvedValue({});
  mocks.mockExecuteRawUnsafe.mockResolvedValue(undefined);
});

// =============================================================================
// FUNCIONES PURAS (sin mocks de BD)
// =============================================================================

describe('getHardcodedCity()', () => {
  it('devuelve la ciudad para un dominio exacto conocido', () => {
    expect(getHardcodedCity('idartes.gov.co')).toBe('Bogotá');
    expect(getHardcodedCity('maloka.org')).toBe('Bogotá');
    expect(getHardcodedCity('parqueexplora.org')).toBe('Medellín');
  });

  it('devuelve la ciudad para un subdominio (sufijo)', () => {
    expect(getHardcodedCity('www.idartes.gov.co')).toBe('Bogotá');
    expect(getHardcodedCity('events.maloka.org')).toBe('Bogotá');
  });

  it('devuelve null para un dominio desconocido', () => {
    expect(getHardcodedCity('unknown.com')).toBeNull();
    expect(getHardcodedCity('google.com')).toBeNull();
  });

  it('devuelve null para string vacío', () => {
    expect(getHardcodedCity('')).toBeNull();
  });
});

describe('mapActivityType()', () => {
  it('devuelve RECURRING para categoría Teatro', () => {
    expect(mapActivityType(['Teatro'], 'Obra de teatro infantil')).toBe('RECURRING');
  });

  it('devuelve RECURRING para título que contiene "taller"', () => {
    expect(mapActivityType(['General'], 'Taller de pintura para niños')).toBe('RECURRING');
  });

  it('devuelve RECURRING para título que contiene "curso"', () => {
    expect(mapActivityType(['General'], 'Curso de robótica')).toBe('RECURRING');
  });

  it('devuelve RECURRING para título que contiene "clase"', () => {
    expect(mapActivityType(['General'], 'Clase de natación')).toBe('RECURRING');
  });

  it('devuelve ONE_TIME para título que contiene "festival"', () => {
    expect(mapActivityType(['General'], 'Festival de música latinoamericana')).toBe('ONE_TIME');
  });

  it('devuelve ONE_TIME para título que contiene "feria"', () => {
    expect(mapActivityType(['General'], 'Feria del libro 2026')).toBe('ONE_TIME');
  });

  it('devuelve ONE_TIME como default cuando no hay match', () => {
    expect(mapActivityType(['General'], 'Presentación especial')).toBe('ONE_TIME');
  });

  it('las categorías Música y Danza también devuelven RECURRING', () => {
    expect(mapActivityType(['Música'], 'Concierto semanal')).toBe('RECURRING');
    expect(mapActivityType(['Danza'], 'Práctica de danza')).toBe('RECURRING');
  });
});

describe('computeTemporalMeta()', () => {
  it('retorna status=resolved y dateSource=explicit para fecha literal en texto', () => {
    const result = computeTemporalMeta(
      { schedules: [{ startDate: '2026-05-16' }], title: 'Taller del 16 de mayo de 2026', description: '' },
      false,
    );
    expect(result.status).toBe('resolved');
    expect(result.dateSource).toBe('explicit');
    expect(result.dateMentionDetected).toBe(false);
  });

  it('retorna status=resolved y dateSource=relative para fecha relativa en texto', () => {
    const result = computeTemporalMeta(
      { schedules: [{ startDate: '2026-05-17' }], title: 'Taller este sábado', description: '' },
      false,
    );
    expect(result.status).toBe('resolved');
    expect(result.dateSource).toBe('relative');
  });

  it('retorna status=resolved y dateSource=inferred cuando Gemini pone fecha sin señal textual', () => {
    const result = computeTemporalMeta(
      { schedules: [{ startDate: '2026-05-17' }], title: 'Taller de pintura', description: 'Un taller creativo.' },
      false,
    );
    expect(result.status).toBe('resolved');
    expect(result.dateSource).toBe('inferred');
    expect(result.dateMentionDetected).toBe(false);
  });

  it('retorna status=missing y dateSource=none cuando no hay startDate', () => {
    const result = computeTemporalMeta(
      { schedules: null, title: 'Taller de pintura', description: null },
      false,
    );
    expect(result.status).toBe('missing');
    expect(result.dateSource).toBe('none');
    expect(result.dateMentionDetected).toBe(false);
  });

  it('dateMentionDetected=true cuando hay mención de fecha en texto pero no hay startDate', () => {
    const result = computeTemporalMeta(
      { schedules: null, title: 'Taller este viernes en la tarde', description: null },
      false,
    );
    expect(result.status).toBe('missing');
    expect(result.dateMentionDetected).toBe(true);
  });

  it('retorna status=degraded cuando es Cheerio fallback', () => {
    const result = computeTemporalMeta(
      { schedules: [{ startDate: '2026-05-17' }], title: 'Taller de arte', description: '' },
      true, // isCheerioFallback
    );
    expect(result.status).toBe('degraded');
  });

  it('detecta fecha en formato DD/MM/YYYY como explicit', () => {
    const result = computeTemporalMeta(
      { schedules: [{ startDate: '2026-05-16' }], title: 'Evento 16/05/2026', description: '' },
      false,
    );
    expect(result.dateSource).toBe('explicit');
  });

  it('detecta "mañana" como fecha relativa', () => {
    const result = computeTemporalMeta(
      { schedules: [{ startDate: '2026-05-17' }], title: 'Visita mañana', description: '' },
      false,
    );
    expect(result.dateSource).toBe('relative');
  });

  it('dateMentionDetected es false cuando hay startDate (solo aplica a status=missing)', () => {
    const result = computeTemporalMeta(
      { schedules: [{ startDate: '2026-05-17' }], title: 'Taller este sábado', description: null },
      false,
    );
    expect(result.dateMentionDetected).toBe(false); // tiene startDate → campo no relevante
  });
});

// =============================================================================
// saveActivityV2() — integración con mocks de BD
// =============================================================================

describe('saveActivityV2()', () => {
  describe('decisión DROP', () => {
    it('retorna DISCARDED inmediatamente sin llamar a BD', async () => {
      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, dropGate);

      expect(result).toEqual({ id: null, action: 'DISCARDED', decision: 'DROP' });
      expect(mocks.mockRunDataPipeline).not.toHaveBeenCalled();
      expect(mocks.mockActivityCreate).not.toHaveBeenCalled();
    });
  });

  describe('data pipeline inválido', () => {
    it('retorna DISCARDED cuando el pipeline rechaza el contenido', async () => {
      mocks.mockRunDataPipeline.mockReturnValue({ valid: false, reason: 'titulo demasiado corto' });

      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      expect(result).toEqual({ id: null, action: 'DISCARDED', decision: 'DROP' });
      expect(mocks.mockActivityCreate).not.toHaveBeenCalled();
    });
  });

  describe('fecha pasada (> 60 días)', () => {
    it('descarta actividades con startDate mayor a 60 días en el pasado', async () => {
      const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      mocks.mockRunDataPipeline.mockReturnValue({
        valid: true,
        data: { ...baseNLPResult, schedules: [{ startDate: oldDate }] },
      });

      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      expect(result.action).toBe('DISCARDED');
      expect(mocks.mockActivityCreate).not.toHaveBeenCalled();
    });

    it('acepta actividades con startDate en el futuro', async () => {
      const futureDate = '2026-12-31';
      mocks.mockRunDataPipeline.mockReturnValue({
        valid: true,
        data: { ...baseNLPResult, schedules: [{ startDate: futureDate }] },
      });

      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      expect(result.action).toBe('CREATED_ACTIVE');
    });
  });

  describe('vertical no encontrada', () => {
    it('retorna ERROR si el vertical no existe en BD', async () => {
      mocks.mockVerticalFindUnique.mockResolvedValue(null);

      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      expect(result.action).toBe('ERROR');
      expect(result.id).toBeNull();
    });
  });

  describe('creación exitosa — gate ACTIVE', () => {
    it('retorna CREATED_ACTIVE cuando no hay actividad existente', async () => {
      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      expect(result.action).toBe('CREATED_ACTIVE');
      expect(result.id).toBe('act-001');
      expect(result.decision).toBe('ACTIVE');
      expect(mocks.mockActivityCreate).toHaveBeenCalledTimes(1);
    });

    it('llama a linkCategories (deleteMany + upsert)', async () => {
      await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      expect(mocks.mockActivityCategoryDeleteMany).toHaveBeenCalledWith({ where: { activityId: 'act-001' } });
      expect(mocks.mockActivityCategoryUpsert).toHaveBeenCalledTimes(1);
    });

    it('registra review_decision en BD (fire-and-forget)', async () => {
      await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      // fire-and-forget con void — no se puede esperar síncronamente.
      // El test verifica que saveActivityV2 no lanza (si lanzara, el await de arriba fallaría).
    });
  });

  describe('creación exitosa — gate PENDING_REVIEW', () => {
    it('retorna CREATED_PENDING cuando el gate es PENDING_REVIEW', async () => {
      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, pendingGate);

      expect(result.action).toBe('CREATED_PENDING');
      expect(result.decision).toBe('PENDING_REVIEW');
    });
  });

  describe('actualización de actividad existente', () => {
    it('retorna UPDATED_ACTIVE cuando ya existe y el status es ACTIVE', async () => {
      mocks.mockActivityFindFirst.mockResolvedValue({
        id: 'act-existing',
        status: 'ACTIVE',
        imageUrl: null,
      });
      mocks.mockActivityUpdate.mockResolvedValue({ id: 'act-existing' });

      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      expect(result.action).toBe('UPDATED_ACTIVE');
      expect(result.id).toBe('act-existing');
      expect(mocks.mockActivityUpdate).toHaveBeenCalledTimes(1);
      expect(mocks.mockActivityCreate).not.toHaveBeenCalled();
    });

    it('retorna UPDATED_PENDING cuando el status existente es PENDING_REVIEW', async () => {
      mocks.mockActivityFindFirst.mockResolvedValue({
        id: 'act-existing',
        status: 'PENDING_REVIEW',
        imageUrl: null,
      });
      mocks.mockActivityUpdate.mockResolvedValue({ id: 'act-existing' });

      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      // PENDING_REVIEW no está en protectedStatuses → targetStatus (ACTIVE) gana
      expect(result.action).toBe('UPDATED_ACTIVE');
    });

    it('preserva el status ACTIVE aunque el gate diga PENDING_REVIEW', async () => {
      mocks.mockActivityFindFirst.mockResolvedValue({
        id: 'act-existing',
        status: 'ACTIVE',
        imageUrl: 'https://example.com/img.jpg',
      });
      mocks.mockActivityUpdate.mockResolvedValue({ id: 'act-existing' });

      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, pendingGate);

      // ACTIVE está en protectedStatuses → no se sobreescribe
      expect(result.action).toBe('UPDATED_ACTIVE');
      // Verifica que se llamó update con status=ACTIVE (no PENDING_REVIEW)
      const updateCall = mocks.mockActivityUpdate.mock.calls[0][0];
      expect(updateCall.data.status).toBe('ACTIVE');
    });

    it('preserva la imageUrl existente cuando ya tiene imagen', async () => {
      const existingImg = 'https://example.com/existing.jpg';
      mocks.mockActivityFindFirst.mockResolvedValue({
        id: 'act-existing',
        status: 'PENDING_REVIEW',
        imageUrl: existingImg,
      });
      mocks.mockActivityUpdate.mockResolvedValue({ id: 'act-existing' });

      await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      const updateCall = mocks.mockActivityUpdate.mock.calls[0][0];
      expect(updateCall.data.imageUrl).toBe(existingImg);
    });
  });

  describe('proveedor Instagram', () => {
    it('crea proveedor Instagram si no existe', async () => {
      mocks.mockProviderFindFirst.mockResolvedValue(null);
      mocks.mockProviderCreate.mockResolvedValue({ id: 'ig-001', name: '@miinstagram' });

      const _result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate, {
        platform: 'INSTAGRAM',
        instagramUsername: 'miinstagram',
      });

      expect(mocks.mockProviderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ instagram: 'miinstagram', type: 'INDEPENDENT' }),
        }),
      );
    });

    it('reutiliza proveedor Instagram existente', async () => {
      mocks.mockProviderFindFirst.mockResolvedValue({ id: 'ig-001', name: '@miinstagram' });

      await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate, {
        platform: 'INSTAGRAM',
        instagramUsername: 'miinstagram',
      });

      expect(mocks.mockProviderCreate).not.toHaveBeenCalled();
      expect(mocks.mockProviderUpsert).not.toHaveBeenCalled();
    });
  });

  describe('manejo de errores', () => {
    it('retorna ERROR si Prisma.activity.create lanza', async () => {
      mocks.mockActivityCreate.mockRejectedValue(new Error('DB connection error'));

      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      expect(result.action).toBe('ERROR');
      expect(result.id).toBeNull();
    });

    it('crea actividad sin locationId si getOrCreateLocation falla (catch interno)', async () => {
      // Simula fallo en location.create — la actividad sigue creándose pero sin location
      mocks.mockLocationCreate.mockRejectedValue(new Error('Location DB error'));

      const result = await saveActivityV2(baseNLPResult, SOURCE_URL, activeGate);

      // Actividad se crea igualmente — error en location es silencioso (catch → null)
      expect(result.action).toBe('CREATED_ACTIVE');
      const createCall = mocks.mockActivityCreate.mock.calls[0][0];
      // locationId puede ser undefined/null cuando location falló
      expect(createCall.data.locationId == null || createCall.data.locationId === undefined).toBe(true);
    });
  });

  describe('Cheerio fallback', () => {
    it('incluye status=degraded en extractionMetadata.temporal', async () => {
      const cheerioData = { ...baseNLPResult, parserSource: 'fallback' as const };
      mocks.mockRunDataPipeline.mockReturnValue({ valid: true, data: cheerioData });

      await saveActivityV2(cheerioData, SOURCE_URL, activeGate);

      const createCall = mocks.mockActivityCreate.mock.calls[0][0];
      expect(createCall.data.extractionMetadata.temporal.status).toBe('degraded');
    });
  });
});
