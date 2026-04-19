import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (vi.hoisted para garantizar disponibilidad antes del módulo) ─────────

const { mockAnalyze, mockDiscoverActivityLinks } = vi.hoisted(() => {
  return {
    mockAnalyze:                vi.fn(),
    mockDiscoverActivityLinks:  vi.fn(),
  }
})

vi.mock('../nlp/gemini.analyzer', () => ({
  GeminiAnalyzer: vi.fn(() => ({
    analyze:                mockAnalyze,
    discoverActivityLinks:  mockDiscoverActivityLinks,
  })),
}))

vi.mock('../extractors/cheerio.extractor', () => ({
  CheerioExtractor: vi.fn(() => ({
    extract: vi.fn(),
  })),
}))

// ── Imports después de mocks ──────────────────────────────────────────────────

import { parseActivity, discoverWithFallback, resetParserMetrics, getParserMetrics } from '../parser/parser'
import { fallbackFromCheerio } from '../parser/fallback-mapper'
import type { ScrapedRawData, DiscoveredLink, ActivityNLPResult } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRaw(overrides: Partial<ScrapedRawData> = {}): ScrapedRawData {
  return {
    url:         'https://example.com/actividad',
    html:        '<html><head><title>Taller de Arte</title></head><body>Taller de pintura para niños. El 15 de junio de 2027.</body></html>',
    sourceText:  'Taller de pintura para niños. El 15 de junio de 2027.',
    extractedAt: new Date('2026-04-16'),
    status:      'SUCCESS',
    ...overrides,
  }
}

function makeNLPResult(overrides: Partial<ActivityNLPResult> = {}): ActivityNLPResult {
  return {
    title:           'Taller de Arte',
    description:     'Taller de pintura para niños.',
    categories:      ['Arte'],
    confidenceScore: 0.9,
    currency:        'COP',
    audience:        'KIDS',
    ...overrides,
  }
}

function makeLinks(n: number): DiscoveredLink[] {
  return Array.from({ length: n }, (_, i) => ({
    url:        `https://example.com/actividad-${i + 1}`,
    anchorText: `Actividad ${i + 1}`,
  }))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  resetParserMetrics()
})

// =============================================================================
// parseActivity — Fase 3
// =============================================================================

describe('parseActivity', () => {
  it('devuelve source="gemini" cuando Gemini responde OK', async () => {
    const geminiResult = makeNLPResult()
    mockAnalyze.mockResolvedValue(geminiResult)

    const parsed = await parseActivity('<html>...</html>', 'https://example.com', makeRaw(), {
      analyze: mockAnalyze,
    })

    expect(parsed.source).toBe('gemini')
    expect(parsed.result).toEqual(geminiResult)
    expect(getParserMetrics().geminiOk).toBe(1)
    expect(getParserMetrics().fallbackUsed).toBe(0)
  })

  it('devuelve source="fallback" cuando Gemini lanza 429', async () => {
    mockAnalyze.mockRejectedValue(new Error('Error 429: quota exceeded'))

    const raw = makeRaw()
    const parsed = await parseActivity('<html><title>Test</title></html>', 'https://example.com', raw, {
      analyze: mockAnalyze,
    })

    expect(parsed.source).toBe('fallback')
    expect(parsed.result.confidenceScore).toBe(0.4)
    expect(getParserMetrics().fallbackUsed).toBe(1)
    expect(getParserMetrics().geminiOk).toBe(0)
  })

  it('devuelve source="fallback" cuando Gemini lanza 503', async () => {
    mockAnalyze.mockRejectedValue(new Error('503 Service Unavailable'))

    const parsed = await parseActivity('<html></html>', 'https://example.com', makeRaw(), {
      analyze: mockAnalyze,
    })

    expect(parsed.source).toBe('fallback')
    expect(getParserMetrics().fallbackUsed).toBe(1)
  })

  it('lanza error si el fallo NO es retryable', async () => {
    mockAnalyze.mockRejectedValue(new Error('Invalid JSON response from Gemini'))

    await expect(
      parseActivity('<html></html>', 'https://example.com', makeRaw(), { analyze: mockAnalyze })
    ).rejects.toThrow('Invalid JSON response')

    expect(getParserMetrics().geminiErrors).toBe(1)
    expect(getParserMetrics().fallbackUsed).toBe(0)
  })

  it('el fallback extrae el título del og:title si está disponible', async () => {
    mockAnalyze.mockRejectedValue(new Error('429'))
    const raw = makeRaw({
      html: '<html><head><meta property="og:title" content="Título og:title" /></head><body>Texto</body></html>',
      sourceText: 'Texto',
    })

    const parsed = await parseActivity(raw.html!, raw.url, raw, { analyze: mockAnalyze })

    expect(parsed.source).toBe('fallback')
    expect(parsed.result.title).toBe('Título og:title')
  })

  it('el fallback usa "Sin título" si no hay título en HTML', async () => {
    mockAnalyze.mockRejectedValue(new Error('429'))
    const raw = makeRaw({ html: '<html><body>Texto sin título</body></html>', sourceText: 'Texto sin título' })

    const parsed = await parseActivity(raw.html!, raw.url, raw, { analyze: mockAnalyze })

    expect(parsed.source).toBe('fallback')
    expect(parsed.result.title).toBe('Sin título')
  })

  it('el fallback infiere categoría "Arte" desde keywords en texto', async () => {
    mockAnalyze.mockRejectedValue(new Error('429'))
    const raw = makeRaw({
      html:       '<html><body>Taller de pintura y arte visual</body></html>',
      sourceText: 'Taller de pintura y arte visual',
    })

    const parsed = await parseActivity(raw.html!, raw.url, raw, { analyze: mockAnalyze })

    expect(parsed.result.categories).toContain('Arte')
  })

  it('el fallback usa "General" si no hay keywords de categoría', async () => {
    mockAnalyze.mockRejectedValue(new Error('429'))
    const raw = makeRaw({ html: '<html><body>Información varia</body></html>', sourceText: 'Información varia' })

    const parsed = await parseActivity(raw.html!, raw.url, raw, { analyze: mockAnalyze })

    expect(parsed.result.categories).toEqual(['General'])
  })

  it('el fallback conserva ogImage si está disponible', async () => {
    mockAnalyze.mockRejectedValue(new Error('429'))
    const raw = makeRaw({ ogImage: 'https://example.com/img.jpg' })

    const parsed = await parseActivity(raw.html!, raw.url, raw, { analyze: mockAnalyze })

    expect(parsed.result.imageUrl).toBe('https://example.com/img.jpg')
  })
})

// =============================================================================
// discoverWithFallback — Fase 2
// =============================================================================

describe('discoverWithFallback', () => {
  it('devuelve URLs filtradas por Gemini cuando responde OK', async () => {
    const links = makeLinks(5)
    const filtered = ['https://example.com/actividad-2', 'https://example.com/actividad-4']
    mockDiscoverActivityLinks.mockResolvedValue(filtered)

    const result = await discoverWithFallback(links, 'https://example.com', {
      discoverActivityLinks: mockDiscoverActivityLinks,
    })

    expect(result).toEqual(filtered)
    expect(getParserMetrics().discoverOk).toBe(1)
    expect(getParserMetrics().discoverFallback).toBe(0)
  })

  it('devuelve TODOS los URLs cuando Gemini lanza 429 (fallback conservador)', async () => {
    const links = makeLinks(4)
    mockDiscoverActivityLinks.mockRejectedValue(new Error('429: quota exceeded'))

    const result = await discoverWithFallback(links, 'https://example.com', {
      discoverActivityLinks: mockDiscoverActivityLinks,
    })

    expect(result).toHaveLength(4)
    expect(result).toEqual(links.map((l) => l.url))
    expect(getParserMetrics().discoverFallback).toBe(1)
    expect(getParserMetrics().discoverOk).toBe(0)
  })

  it('devuelve TODOS los URLs cuando Gemini lanza 503', async () => {
    const links = makeLinks(3)
    mockDiscoverActivityLinks.mockRejectedValue(new Error('503 overload'))

    const result = await discoverWithFallback(links, 'https://example.com', {
      discoverActivityLinks: mockDiscoverActivityLinks,
    })

    expect(result).toHaveLength(3)
    expect(getParserMetrics().discoverFallback).toBe(1)
  })

  it('lanza error si el fallo NO es retryable', async () => {
    const links = makeLinks(2)
    mockDiscoverActivityLinks.mockRejectedValue(new Error('Network connection refused'))

    await expect(
      discoverWithFallback(links, 'https://example.com', { discoverActivityLinks: mockDiscoverActivityLinks })
    ).rejects.toThrow('Network connection refused')

    expect(getParserMetrics().discoverFallback).toBe(0)
  })

  it('devuelve array vacío sin llamar a Gemini si links está vacío', async () => {
    const result = await discoverWithFallback([], 'https://example.com', {
      discoverActivityLinks: mockDiscoverActivityLinks,
    })

    expect(result).toEqual([])
    expect(mockDiscoverActivityLinks).not.toHaveBeenCalled()
  })
})

// =============================================================================
// isRetryableError
// =============================================================================

describe('isRetryableError (via parseActivity)', () => {
  it('timeout es retryable', async () => {
    mockAnalyze.mockRejectedValue(new Error('Request timed out after 30000ms'))

    const parsed = await parseActivity('<html></html>', 'https://x.com', makeRaw(), { analyze: mockAnalyze })
    expect(parsed.source).toBe('fallback')
  })

  it('error genérico de red NO es retryable', async () => {
    mockAnalyze.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(
      parseActivity('<html></html>', 'https://x.com', makeRaw(), { analyze: mockAnalyze })
    ).rejects.toThrow('ECONNREFUSED')
  })
})

// =============================================================================
// Métricas de sesión
// =============================================================================

describe('getParserMetrics / resetParserMetrics', () => {
  it('arranca en ceros después de reset', () => {
    const m = getParserMetrics()
    expect(m.geminiOk).toBe(0)
    expect(m.fallbackUsed).toBe(0)
    expect(m.geminiErrors).toBe(0)
    expect(m.discoverOk).toBe(0)
    expect(m.discoverFallback).toBe(0)
  })

  it('acumula correctamente múltiples llamadas', async () => {
    mockAnalyze.mockResolvedValueOnce(makeNLPResult())
    mockAnalyze.mockRejectedValueOnce(new Error('429'))

    await parseActivity('<html></html>', 'https://a.com', makeRaw(), { analyze: mockAnalyze })
    await parseActivity('<html></html>', 'https://b.com', makeRaw(), { analyze: mockAnalyze })

    const m = getParserMetrics()
    expect(m.geminiOk).toBe(1)
    expect(m.fallbackUsed).toBe(1)
  })
})

// =============================================================================
// Blacklist anti-no-eventos (fallbackFromCheerio)
// =============================================================================

describe('fallbackFromCheerio — blacklist NON_EVENT_KEYWORDS', () => {
  function makeRawWithTitle(ogTitle: string): ScrapedRawData {
    return {
      url:         'https://example.com/pagina',
      html:        `<html><head><meta property="og:title" content="${ogTitle}" /></head><body>Contenido de la página con información general sobre el lugar y sus servicios disponibles.</body></html>`,
      sourceText:  'Contenido de la página con información general sobre el lugar y sus servicios disponibles.',
      extractedAt: new Date(),
      status:      'SUCCESS',
    }
  }

  it.each([
    ['Tratamiento de datos personales'],
    ['Cómo llegar a Maloka'],
    ['Trabaja con nosotros'],
    ['Sala de prensa — Noticias'],
    ['Política de privacidad'],
    ['Términos y condiciones'],
    ['Preguntas frecuentes'],
    ['PQRS y sugerencias'],
    ['Quiénes somos'],
    ['Contáctenos'],
    ['Compra tu entrada aquí'],
    ['Nuestros servicios educativos'],
  ])('"%s" produce confidenceScore=0', (title) => {
    const raw = makeRawWithTitle(title)
    const result = fallbackFromCheerio(raw)
    expect(result.result.confidenceScore).toBe(0)
    expect(result.source).toBe('fallback')
  })

  it('título de evento real no es bloqueado por el blacklist', () => {
    const raw = makeRawWithTitle('Taller de robótica para niños — Sábado 18 de mayo')
    const result = fallbackFromCheerio(raw)
    expect(result.result.confidenceScore).toBe(0.4)
  })

  it('detecta keyword sin tilde (NFD normalization)', () => {
    // "Como llegar" sin tilde → debe ser bloqueado igual que "Cómo llegar"
    const raw = makeRawWithTitle('Como llegar a nuestras instalaciones')
    const result = fallbackFromCheerio(raw)
    expect(result.result.confidenceScore).toBe(0)
  })

  it('detecta keyword con variación de mayúsculas', () => {
    const raw = makeRawWithTitle('TRABAJA CON NOSOTROS')
    const result = fallbackFromCheerio(raw)
    expect(result.result.confidenceScore).toBe(0)
  })

  it('título vacío / Sin título no es bloqueado por blacklist (otro filtro lo descarta)', () => {
    const raw = makeRawWithTitle('')
    const result = fallbackFromCheerio(raw)
    // Sin título → data-pipeline lo rechazará por 'title_invalid_or_missing', no blacklist
    expect(result.result.confidenceScore).toBe(0.4)
  })
})
