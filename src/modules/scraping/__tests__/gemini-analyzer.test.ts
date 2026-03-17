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

import { GeminiAnalyzer } from '../nlp/gemini.analyzer';

const validNLPResult = {
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
        const invalid = { title: 'Algo', confidenceScore: 'no-numero' };
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
    });

    describe('discoverActivityLinks()', () => {
      it('mapea índices a URLs correctamente', async () => {
        const links = [
          { url: 'https://x.com/taller', anchorText: 'Taller' },
          { url: 'https://x.com/contacto', anchorText: 'Contacto' },
          { url: 'https://x.com/curso', anchorText: 'Curso' },
        ];
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [1, 3] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://x.com');
        expect(result).toEqual(['https://x.com/taller', 'https://x.com/curso']);
      });

      it('ignora índices fuera de rango (> chunk.length)', async () => {
        const links = [
          { url: 'https://x.com/taller', anchorText: 'Taller' },
        ];
        // índice 1 es válido, índice 99 excede el tamaño del chunk (1)
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [1, 99] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://x.com');
        expect(result).toEqual(['https://x.com/taller']);
      });

      it('devuelve array vacío si Gemini retorna indices: []', async () => {
        const links = [{ url: 'https://x.com/nosotros', anchorText: 'Nosotros' }];
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://x.com');
        expect(result).toEqual([]);
      });

      it('continúa con otros lotes si un lote falla con JSON inválido', async () => {
        // 55 links → 2 lotes. El primero falla, el segundo ok (índice 1 → link 51)
        const links = Array.from({ length: 55 }, (_, i) => ({
          url: `https://x.com/link-${i + 1}`,
          anchorText: `Link ${i + 1}`,
        }));
        mockGenerateContent
          .mockResolvedValueOnce(makeResponse('{ json roto'))
          .mockResolvedValueOnce(makeResponse(JSON.stringify({ indices: [1] })));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://x.com');
        expect(result).toContain('https://x.com/link-51');
      });

      it('continúa si un lote devuelve schema inválido', async () => {
        const links = [{ url: 'https://x.com/ok', anchorText: 'OK' }];
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ activityUrls: [] }))); // schema incorrecto
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://x.com');
        expect(result).toEqual([]);
      });

      it('maneja error general del lote (catch branch)', async () => {
        const links = [{ url: 'https://x.com/taller', anchorText: 'Taller' }];
        mockGenerateContent.mockRejectedValue(new Error('Network error'));
        const analyzer = new GeminiAnalyzer();
        const result = await analyzer.discoverActivityLinks(links, 'https://x.com');
        expect(result).toEqual([]);
      });

      it('procesa links en lotes de 50', async () => {
        const links = Array.from({ length: 110 }, (_, i) => ({
          url: `https://x.com/link-${i + 1}`,
          anchorText: `Link ${i + 1}`,
        }));
        mockGenerateContent.mockResolvedValue(makeResponse(JSON.stringify({ indices: [] })));
        const analyzer = new GeminiAnalyzer();
        await analyzer.discoverActivityLinks(links, 'https://x.com');
        // 110 links → 3 lotes (50, 50, 10)
        expect(mockGenerateContent).toHaveBeenCalledTimes(3);
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
      const invalidSchema = { title: 'Algo', confidenceScore: 'no-num' };
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
