import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() asegura que estas variables estén disponibles cuando vi.mock() se ejecuta
const { mockGenerateContent, mockGetGenerativeModel } = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockGetGenerativeModel = vi.fn(function() {
    return { generateContent: mockGenerateContent };
  });
  return { mockGenerateContent, mockGetGenerativeModel };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function(this: Record<string, unknown>) {
    this.getGenerativeModel = mockGetGenerativeModel;
  }),
}));

vi.mock('../../../lib/quota-tracker', () => ({
  quota: {
    markExhausted: vi.fn().mockResolvedValue(undefined),
    isAvailable: vi.fn().mockResolvedValue(true),
  },
  getAvailableKey: vi.fn().mockImplementation(async () => {
    return process.env.GOOGLE_AI_STUDIO_KEY || 'mock-key';
  }),
}));

import { GeminiAnalyzer } from '../nlp/gemini.analyzer';

const validNLPResult = {
  isActivity: true,
  title: 'Taller de Ciencias',
  description: 'Experimentos para niños de 6 a 12 años',
  categories: ['Ciencia'],
  confidenceScore: 0.88,
  currency: 'COP',
};

function makeResponse(text: string) {
  return { response: { text: () => text } };
}

describe('GeminiAnalyzer', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockClear();
  });

  // ── Sin API key → mock path ──────────────────────────────────────────────
  describe('sin GOOGLE_AI_STUDIO_KEY', () => {
    beforeEach(() => {
      vi.stubEnv('GOOGLE_AI_STUDIO_KEY', '');
    });

    it('analyze() devuelve mockAnalysis sin llamar a Gemini', async () => {
      const analyzer = new GeminiAnalyzer();
      const result = await analyzer.analyze('texto', 'https://example.com/taller');
      expect(mockGenerateContent).not.toHaveBeenCalled();
      expect(result.title).toBe('Actividad Infantil (Mock)');
      expect(result.confidenceScore).toBe(0.85);
    });

    it('mockAnalysis incluye URL en descripción', async () => {
      const analyzer = new GeminiAnalyzer();
      const url = 'https://bibloRed.com/evento';
      const result = await analyzer.analyze('texto', url);
      expect(result.description).toContain(url);
    });

    it('discoverActivityLinks() devuelve todos los links sin filtrar', async () => {
      const analyzer = new GeminiAnalyzer();
      const links = [
        { url: 'https://a.com/1', anchorText: 'Link 1' },
        { url: 'https://a.com/2', anchorText: 'Link 2' },
      ];
      const result = await analyzer.discoverActivityLinks(links, 'https://a.com');
      expect(result).toEqual(['https://a.com/1', 'https://a.com/2']);
    });
  });

  // ── Con API key → llama a Gemini ─────────────────────────────────────────
  describe('con GOOGLE_AI_STUDIO_KEY', () => {
    beforeEach(() => {
      vi.stubEnv('GOOGLE_AI_STUDIO_KEY', 'test-gemini-key');
    });

    describe('analyze()', () => {
      it('parsea respuesta JSON correctamente', async () => {
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify(validNLPResult)));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.analyze('texto', 'https://example.com');
        expect(result.title).toBe('Taller de Ciencias');
        expect(result.confidenceScore).toBe(0.88);
      });

      it('limpia markdown code fences del JSON', async () => {
        const raw = '```json\n' + JSON.stringify(validNLPResult) + '\n```';
        mockGenerateContent.mockResolvedValue(makeResponse(raw));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.analyze('texto', 'https://example.com');
        expect(result.title).toBe('Taller de Ciencias');
      });

      it('devuelve resultado vacío cuando confidenceScore < 0.1', async () => {
        const lowConfidence = { ...validNLPResult, confidenceScore: 0.05 };
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify(lowConfidence)));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.analyze('texto', 'https://example.com/pagina');
        expect(result.title).toBe('No identificado');
        expect(result.confidenceScore).toBe(0);
      });

      it('lanza error si el JSON es inválido', async () => {
        mockGenerateContent.mockResolvedValue(makeResponse('{ esto no es json'));
        const analyzer = new GeminiAnalyzer();
        await expect(analyzer.analyze('texto', 'https://example.com'))
          .rejects.toThrow('Gemini retornó JSON inválido');
      });

      it('lanza error si la respuesta no cumple el schema Zod', async () => {
        // Necesita isActivity:true para pasar el gate semántico y llegar al check de Zod
        const invalid = { isActivity: true, title: 'Algo', confidenceScore: 'no-numero' };
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify(invalid)));
        const analyzer = new GeminiAnalyzer();
        await expect(analyzer.analyze('texto', 'https://example.com'))
          .rejects.toThrow('schema');
      });

      it('re-lanza errores de Gemini', async () => {
        mockGenerateContent.mockRejectedValue(new Error('Gemini service unavailable'));
        const analyzer = new GeminiAnalyzer();
        await expect(analyzer.analyze('texto', 'https://example.com'))
          .rejects.toThrow('Gemini service unavailable');
      });

      it('maneja respuesta array de Gemini — toma primer elemento (línea 173)', async () => {
        // Gemini retorna [objeto] en vez de objeto directo
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify([validNLPResult])));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.analyze('texto', 'https://example.com');
        expect(result.title).toBe('Taller de Ciencias');
        expect(result.confidenceScore).toBe(0.88);
      });
    });

    describe('discoverActivityLinks()', () => {
      it('mapea índices a URLs correctamente', async () => {
        const links = [
          { url: 'https://example.com/evento-taller-infantil', anchorText: 'Taller' },
          { url: 'https://example.com/contacto-nosotros-faq', anchorText: 'Contacto' },
          { url: 'https://example.com/actividad-curso-vacacional', anchorText: 'Curso' },
        ];
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [1, 3] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://example.com');
        expect(result).toEqual(['https://example.com/evento-taller-infantil', 'https://example.com/actividad-curso-vacacional']);
      });

      it('ignora índices fuera de rango (> chunk.length)', async () => {
        const links = [
          { url: 'https://example.com/evento-taller-infantil', anchorText: 'Taller' },
        ];
        // índice 1 es válido, índice 99 excede el tamaño del chunk (1)
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [1, 99] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://example.com');
        expect(result).toEqual(['https://example.com/evento-taller-infantil']);
      });

      it('devuelve array vacío si Gemini retorna indices: []', async () => {
        const links = [{ url: 'https://example.com/nosotros', anchorText: 'Nosotros' }];
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://example.com');
        expect(result).toEqual([]);
      });

      it('continúa con otros lotes si un lote falla con JSON inválido', async () => {
        // 200 links → 2 lotes (100, 100). El primero falla, el segundo ok (índice 1 → link-101)
        const links = Array.from({ length: 200 }, (_, i) => ({
          url: `https://example.com/evento-infantil-link-${i + 1}`,
          anchorText: `Link ${i + 1}`,
        }));
        mockGenerateContent
          .mockResolvedValueOnce(makeResponse('{ json roto'))
          .mockResolvedValueOnce(makeResponse(JSON.stringify({ indices: [1] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://example.com');
        expect(result).toContain('https://example.com/evento-infantil-link-101');
      });

      it('continúa si un lote devuelve schema inválido', async () => {
        const links = [{ url: 'https://example.com/evento-ok-infantil', anchorText: 'OK' }];
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ activityUrls: [] }))); // schema incorrecto
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://example.com');
        expect(result).toEqual([]);
      });

      it('maneja error general del lote (catch branch)', async () => {
        const links = [{ url: 'https://example.com/evento-taller-infantil', anchorText: 'Taller' }];
        mockGenerateContent.mockRejectedValue(new Error('Network error'));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://example.com');
        expect(result).toEqual([]);
      });

      it('re-lanza error 429 si TODOS los lotes fallan y no hay resultados (activa fallback en discoverWithFallback)', async () => {
        const links = [
          { url: 'https://example.com/evento-taller-infantil', anchorText: 'Taller' },
          { url: 'https://example.com/actividad-curso-vacacional', anchorText: 'Curso' },
        ];
        const quotaError = new Error('[429 Too Many Requests] quota exceeded');
        mockGenerateContent.mockRejectedValue(quotaError);
        const analyzer = new GeminiAnalyzer();
        await expect(analyzer.discoverActivityLinks(links, 'https://example.com')).rejects.toThrow('429');
      }, 15000); // callWithRetry: 2s + 4s delays + enforceRateLimit

      it('devuelve resultados parciales si algún lote fue exitoso (no re-lanza aunque otro lote falle con 429)', async () => {
        // 200 links → 2 lotes. El primero ok (índice 1 → link-1), el segundo 429
        const links = Array.from({ length: 200 }, (_, i) => ({
          url: `https://example.com/evento-infantil-link-${i + 1}`,
          anchorText: `Link ${i + 1}`,
        }));
        const quotaError = new Error('[429 Too Many Requests] quota exceeded');
        mockGenerateContent
          .mockResolvedValueOnce(makeResponse(JSON.stringify({ indices: [1] }))) // lote 1 ok
          .mockRejectedValueOnce(quotaError);                                     // lote 2 falla
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://example.com');
        // Debería retornar el resultado parcial del lote 1, sin re-lanzar
        expect(result).toContain('https://example.com/evento-infantil-link-1');
        expect(result).toHaveLength(1);
      });

      it('procesa links en lotes de 100', async () => {
        const links = Array.from({ length: 450 }, (_, i) => ({
          url: `https://example.com/evento-infantil-link-${i + 1}`,
          anchorText: `Link ${i + 1}`,
        }));
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [] })));
        const analyzer = new GeminiAnalyzer();
        await analyzer.discoverActivityLinks(links, 'https://example.com');
        // 450 links → 5 lotes (100, 100, 100, 100, 50) — CHUNK_SIZE=100 (benchmark S34)
        expect(mockGenerateContent).toHaveBeenCalledTimes(5);
      });

      it('excluye URLs con query params en pre-filtro y registra log (línea 223)', async () => {
        const links = [
          { url: 'https://example.com/evento-taller-infantil', anchorText: 'Taller' },
          { url: 'https://example.com/actividades?page=2', anchorText: 'Pág 2' },
          { url: 'https://example.com/curso?f[0]=arte', anchorText: 'Filtro' },
        ];
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [1] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://example.com');
        expect(result).toEqual(['https://example.com/evento-taller-infantil']);
      });

      it('incluye URL inválida en pre-filtro (catch branch línea 219)', async () => {
        const links = [
          { url: 'https://example.com/evento-taller-infantil', anchorText: 'Taller' },
          { url: 'not-a-valid-url-evento', anchorText: 'Inválido' },
        ];
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [1, 2] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://example.com');
        expect(result.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ── analyzeInstagramPost() ─────────────────────────────────────────────
  describe('analyzeInstagramPost()', () => {
    beforeEach(() => {
      vi.stubEnv('GOOGLE_AI_STUDIO_KEY', 'test-key');
    });

    const samplePost = {
      url: 'https://www.instagram.com/p/ABC123/',
      caption: 'Taller de pintura para ninos! Sabado 22 de marzo. Inscripciones abiertas. #arte #talleres #ninos',
      imageUrls: ['https://instagram.com/img.jpg'],
      timestamp: '2026-03-15T10:00:00.000Z',
      likesCount: 50,
    };
    const profileBio = 'Academia de Arte. Cra 15 #80-20, Bogota. Tel: 3001234567';

    const validIGResult = {
      title: 'Taller de Pintura Infantil',
      description: 'Taller de pintura para ninos',
      categories: ['Arte'],
      confidenceScore: 0.85,
      currency: 'COP',
    };

    it('analiza post de Instagram correctamente', async () => {
      mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify(validIGResult)));
      const analyzer = new GeminiAnalyzer();
      const result = await analyzer.analyzeInstagramPost(samplePost, profileBio);
      expect(result.title).toBe('Taller de Pintura Infantil');
      expect(result.confidenceScore).toBe(0.85);
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('devuelve "No identificado" cuando confianza < 0.1', async () => {
      const lowConfidence = { ...validIGResult, confidenceScore: 0.05 };
      mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify(lowConfidence)));
      const analyzer = new GeminiAnalyzer();
      const result = await analyzer.analyzeInstagramPost(samplePost, profileBio);
      expect(result.title).toBe('No identificado');
      expect(result.confidenceScore).toBe(0);
    });

    it('lanza error si JSON es invalido', async () => {
      mockGenerateContent.mockResolvedValue(makeResponse('not json'));
      const analyzer = new GeminiAnalyzer();
      await expect(analyzer.analyzeInstagramPost(samplePost, profileBio))
        .rejects.toThrow('JSON inválido para Instagram');
    });

    it('envia caption y bio en el prompt a Gemini', async () => {
      mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify(validIGResult)));
      const analyzer = new GeminiAnalyzer();
      await analyzer.analyzeInstagramPost(samplePost, profileBio);

      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg).toContain('Taller de pintura');
      expect(callArg).toContain('Academia de Arte');
      expect(callArg).toContain('instagram.com/p/ABC123');
    });

    it('usa mock si no hay API key', async () => {
      vi.stubEnv('GOOGLE_AI_STUDIO_KEY', '');
      const analyzer = new GeminiAnalyzer();
      const result = await analyzer.analyzeInstagramPost(samplePost, profileBio);
      expect(result.title).toBe('Actividad Infantil (Mock)');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('lanza error si respuesta de IG no cumple schema Zod', async () => {
      // Necesita isActivity:true para pasar el gate y llegar al check de Zod
      const invalidSchema = { isActivity: true, title: 'Algo', confidenceScore: 'no-num' };
      mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify(invalidSchema)));
      const analyzer = new GeminiAnalyzer();
      await expect(analyzer.analyzeInstagramPost(samplePost, profileBio))
        .rejects.toThrow('schema');
    });

    it('re-lanza errores de API en Instagram', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));
      const analyzer = new GeminiAnalyzer();
      await expect(analyzer.analyzeInstagramPost(samplePost, profileBio))
        .rejects.toThrow('Gemini API error');
    });

    it('maneja respuesta array de Gemini — toma primer elemento (líneas 363-364)', async () => {
      const validIGResult = {
        title: 'Taller de Pintura Infantil',
        description: 'Aprende pintura',
        categories: ['Arte'],
        confidenceScore: 0.85,
        currency: 'COP',
      };
      // Gemini retorna un array en lugar de objeto
      mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify([validIGResult])));
      const analyzer = new GeminiAnalyzer();
      const result = await analyzer.analyzeInstagramPost(samplePost, profileBio);
      expect(result.title).toBe('Taller de Pintura Infantil');
      expect(result.confidenceScore).toBe(0.85);
    });
  });

  // ── callWithRetry (vía analyze) ──────────────────────────────────────────
  describe('callWithRetry', () => {
    beforeEach(() => {
      vi.stubEnv('GOOGLE_AI_STUDIO_KEY', 'test-key');
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reintenta en error 503 y tiene éxito en segundo intento', async () => {
      const err503 = Object.assign(new Error('503 Service Unavailable'), { status: 503 });
      mockGenerateContent
        .mockRejectedValueOnce(err503)
        .mockResolvedValueOnce(makeResponse(JSON.stringify(validNLPResult)));

      const analyzer = new GeminiAnalyzer();
      const promise = analyzer.analyze('texto', 'https://example.com');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.title).toBe('Taller de Ciencias');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('lanza error después de agotar reintentos', async () => {
      const err429 = Object.assign(new Error('429 Too Many Requests'), { status: 429 });
      mockGenerateContent.mockRejectedValue(err429);

      const analyzer = new GeminiAnalyzer();
      const promise = analyzer.analyze('texto', 'https://example.com');
      // Registrar el handler ANTES de correr timers para evitar unhandled rejection
      const assertion = expect(promise).rejects.toThrow('429 Too Many Requests');
      await vi.runAllTimersAsync();
      await assertion;
      expect(mockGenerateContent).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
    });

    it('no reintenta en error no retryable (400)', async () => {
      const err400 = Object.assign(new Error('400 Bad Request'), { status: 400 });
      mockGenerateContent.mockRejectedValue(err400);

      const analyzer = new GeminiAnalyzer();
      const promise = analyzer.analyze('texto', 'https://example.com');
      const assertion = expect(promise).rejects.toThrow('400 Bad Request');
      await vi.runAllTimersAsync();
      await assertion;
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });
});
