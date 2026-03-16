import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeAnalyzer } from '../nlp/claude.analyzer';

describe('ClaudeAnalyzer', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // ── Sin API key → mock path ──────────────────────────────────────────────
  describe('sin ANTHROPIC_API_KEY', () => {
    beforeEach(() => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');
    });

    it('analyze() devuelve mockAnalysis sin llamar a fetch', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const analyzer = new ClaudeAnalyzer();
      const result = await analyzer.analyze('contenido de prueba', 'https://example.com/actividad');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.title).toBe('Actividad Infantil (Mock)');
      expect(result.confidenceScore).toBe(0.85);
      expect(result.currency).toBe('COP');
    });

    it('mockAnalysis incluye la URL en la descripción', async () => {
      const analyzer = new ClaudeAnalyzer();
      const url = 'https://test.com/taller-pintura';
      const result = await analyzer.analyze('text', url);
      expect(result.description).toContain(url);
    });

    it('mockAnalysis tiene categorías, edades y precio', async () => {
      const analyzer = new ClaudeAnalyzer();
      const result = await analyzer.analyze('text', 'https://x.com');
      expect(result.categories).toContain('General');
      expect(result.minAge).toBe(4);
      expect(result.maxAge).toBe(12);
      expect(result.price).toBe(50000);
      expect(result.pricePeriod).toBe('MONTHLY');
    });
  });

  // ── Con API key → llama a fetch ──────────────────────────────────────────
  describe('con ANTHROPIC_API_KEY', () => {
    beforeEach(() => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key');
    });

    const validNLPResult = {
      title: 'Taller de Pintura',
      description: 'Taller para niños de 5 a 10 años',
      categories: ['Arte'],
      confidenceScore: 0.9,
      currency: 'COP',
    };

    function mockFetchSuccess(body: unknown) {
      return vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(body) }],
        }),
      } as Response);
    }

    it('llama a la API de Anthropic con la URL correcta', async () => {
      const fetchSpy = mockFetchSuccess(validNLPResult);
      const analyzer = new ClaudeAnalyzer();
      await analyzer.analyze('texto crudo', 'https://example.com');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('devuelve resultado validado cuando la API responde correctamente', async () => {
      mockFetchSuccess(validNLPResult);
      const analyzer = new ClaudeAnalyzer();
      const result = await analyzer.analyze('texto crudo', 'https://example.com');
      expect(result.title).toBe('Taller de Pintura');
      expect(result.confidenceScore).toBe(0.9);
    });

    it('limpia markdown code fences del JSON', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: '```json\n' + JSON.stringify(validNLPResult) + '\n```' }],
        }),
      } as Response);
      const analyzer = new ClaudeAnalyzer();
      const result = await analyzer.analyze('texto', 'https://example.com');
      expect(result.title).toBe('Taller de Pintura');
    });

    it('lanza error si la API devuelve data.error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      } as Response);
      const analyzer = new ClaudeAnalyzer();
      await expect(analyzer.analyze('texto', 'https://example.com'))
        .rejects.toThrow('Claude API error: Invalid API key');
    });

    it('lanza error si el JSON es inválido', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'esto no es JSON {{{' }] }),
      } as Response);
      const analyzer = new ClaudeAnalyzer();
      await expect(analyzer.analyze('texto', 'https://example.com'))
        .rejects.toThrow('Claude retornó JSON inválido');
    });

    it('lanza error si la respuesta no cumple el schema Zod', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify({ title: 'Solo título, sin más campos requeridos', confidenceScore: 'no-es-numero' }) }],
        }),
      } as Response);
      const analyzer = new ClaudeAnalyzer();
      await expect(analyzer.analyze('texto', 'https://example.com'))
        .rejects.toThrow('schema');
    });

    it('trunca el sourceText a 15000 caracteres', async () => {
      const fetchSpy = mockFetchSuccess(validNLPResult);
      const analyzer = new ClaudeAnalyzer();
      const longText = 'a'.repeat(20000);
      await analyzer.analyze(longText, 'https://example.com');
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      const userContent = body.messages[0].content as string;
      expect(userContent.length).toBeLessThan(16000); // 15000 + URL prefix
    });
  });
});
