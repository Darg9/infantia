import { describe, it, expect, vi, afterEach } from 'vitest';
import { CheerioExtractor } from '../extractors/cheerio.extractor';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(html: string, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    text: async () => html,
  }));
}

function mockFetchSequence(responses: Array<{ html: string; ok?: boolean }>) {
  const mockFn = vi.fn();
  responses.forEach(({ html, ok = true }) => {
    mockFn.mockResolvedValueOnce({
      ok,
      status: ok ? 200 : 404,
      statusText: ok ? 'OK' : 'Not Found',
      text: async () => html,
    });
  });
  vi.stubGlobal('fetch', mockFn);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── extract() ────────────────────────────────────────────────────────────────

describe('CheerioExtractor.extract()', () => {
  it('extrae texto de HTML simple correctamente', async () => {
    mockFetch(`<html><body><p>Taller de pintura para niños</p></body></html>`);
    const extractor = new CheerioExtractor();
    const result = await extractor.extract('https://example.com/taller');
    expect(result.status).toBe('SUCCESS');
    expect(result.sourceText).toContain('Taller de pintura para niños');
    expect(result.url).toBe('https://example.com/taller');
  });

  it('elimina tags script, style, nav, footer del texto', async () => {
    mockFetch(`<html><body>
      <nav>Menú de navegación</nav>
      <script>alert('hola')</script>
      <style>.foo { color: red }</style>
      <main>Contenido útil del taller</main>
      <footer>Footer ignorado</footer>
    </body></html>`);
    const extractor = new CheerioExtractor();
    const result = await extractor.extract('https://example.com');
    expect(result.sourceText).toContain('Contenido útil del taller');
    expect(result.sourceText).not.toContain('Menú de navegación');
    expect(result.sourceText).not.toContain("alert('hola')");
    expect(result.sourceText).not.toContain('.foo');
  });

  it('extrae JSON-LD de tipo Event', async () => {
    const jsonLd = JSON.stringify({
      '@type': 'Event',
      name: 'Concierto Infantil',
      startDate: '2026-04-01',
    });
    mockFetch(`<html><head>
      <script type="application/ld+json">${jsonLd}</script>
    </head><body><p>Descripción del evento</p></body></html>`);
    const extractor = new CheerioExtractor();
    const result = await extractor.extract('https://example.com/evento');
    expect(result.status).toBe('SUCCESS');
    expect(result.sourceText).toContain('DATOS ESTRUCTURADOS JSON-LD');
    expect(result.sourceText).toContain('Concierto Infantil');
  });

  it('ignora JSON-LD que no es Event ni Article', async () => {
    const jsonLd = JSON.stringify({ '@type': 'Organization', name: 'Empresa' });
    mockFetch(`<html><head>
      <script type="application/ld+json">${jsonLd}</script>
    </head><body><p>Texto</p></body></html>`);
    const extractor = new CheerioExtractor();
    const result = await extractor.extract('https://example.com');
    expect(result.sourceText).not.toContain('DATOS ESTRUCTURADOS JSON-LD');
  });

  it('devuelve status FAILED si fetch lanza error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));
    const extractor = new CheerioExtractor();
    const result = await extractor.extract('https://unreachable.com');
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('Connection refused');
    expect(result.sourceText).toBe('');
  });

  it('devuelve status FAILED si la respuesta HTTP es error', async () => {
    mockFetch('', false, 404);
    const extractor = new CheerioExtractor();
    const result = await extractor.extract('https://example.com/no-existe');
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('HTTP Error: 404');
  });

  it('incluye extractedAt en el resultado', async () => {
    mockFetch('<html><body>Texto</body></html>');
    const extractor = new CheerioExtractor();
    const result = await extractor.extract('https://example.com');
    expect(result.extractedAt).toBeInstanceOf(Date);
  });
});

// ── extractLinks() ───────────────────────────────────────────────────────────

describe('CheerioExtractor.extractLinks()', () => {
  it('extrae links del mismo dominio', async () => {
    mockFetch(`<html><body>
      <a href="/taller-pintura">Taller de Pintura</a>
      <a href="/curso-musica">Curso de Música</a>
    </body></html>`);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractLinks('https://example.com/actividades');
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links.some(l => l.url.includes('taller-pintura'))).toBe(true);
    expect(links.some(l => l.url.includes('curso-musica'))).toBe(true);
  });

  it('filtra links externos (otro dominio)', async () => {
    mockFetch(`<html><body>
      <a href="https://externo.com/algo">Externo</a>
      <a href="/interno">Interno</a>
    </body></html>`);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractLinks('https://example.com');
    expect(links.every(l => l.url.includes('example.com'))).toBe(true);
    expect(links.some(l => l.url.includes('externo.com'))).toBe(false);
  });

  it('filtra anchors, mailto, javascript y tel', async () => {
    mockFetch(`<html><body>
      <a href="#seccion">Ancla</a>
      <a href="mailto:info@example.com">Email</a>
      <a href="javascript:void(0)">JS</a>
      <a href="tel:+573001234567">Teléfono</a>
      <a href="/actividad-valida">Válida</a>
    </body></html>`);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractLinks('https://example.com');
    expect(links.length).toBe(1);
    expect(links[0].url).toContain('actividad-valida');
  });

  it('deduplica URLs (misma URL dos veces)', async () => {
    mockFetch(`<html><body>
      <a href="/taller">Taller 1</a>
      <a href="/taller">Taller 1 duplicado</a>
    </body></html>`);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractLinks('https://example.com');
    expect(links.length).toBe(1);
  });

  it('ignora la URL de listado misma', async () => {
    mockFetch(`<html><body>
      <a href="/actividades">Esta misma página</a>
      <a href="/taller">Taller</a>
    </body></html>`);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractLinks('https://example.com/actividades');
    expect(links.every(l => !l.url.endsWith('/actividades'))).toBe(true);
  });

  it('usa la URL como anchorText si el texto del link está vacío', async () => {
    mockFetch(`<html><body>
      <a href="/sin-texto"></a>
    </body></html>`);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractLinks('https://example.com');
    expect(links[0].anchorText).toContain('example.com/sin-texto');
  });

  it('lanza error si HTTP response no es ok', async () => {
    mockFetch('', false, 403);
    const extractor = new CheerioExtractor();
    await expect(extractor.extractLinks('https://example.com')).rejects.toThrow('HTTP Error: 403');
  });
});

// ── extractLinksAllPages() ───────────────────────────────────────────────────

describe('CheerioExtractor.extractLinksAllPages()', () => {
  it('devuelve links de una sola página cuando no hay paginación', async () => {
    // extractLinks (pág 1) + findNextPage (misma pág 1) → sin link "Siguiente"
    mockFetchSequence([
      { html: `<html><body><a href="/taller">Taller</a></body></html>` },
      { html: `<html><body><a href="/taller">Taller</a></body></html>` }, // findNextPage
    ]);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractLinksAllPages('https://example.com/actividades');
    expect(links.some(l => l.url.includes('taller'))).toBe(true);
  });

  it('sigue a la página siguiente cuando hay link "Siguiente"', async () => {
    mockFetchSequence([
      // pág 1: extractLinks
      { html: `<html><body>
        <a href="/taller-1">Taller 1</a>
        <a href="/actividades?page=2">Siguiente</a>
      </body></html>` },
      // pág 1: findNextPage (misma petición)
      { html: `<html><body>
        <a href="/taller-1">Taller 1</a>
        <a href="/actividades?page=2">Siguiente</a>
      </body></html>` },
      // pág 2: extractLinks
      { html: `<html><body>
        <a href="/taller-2">Taller 2</a>
      </body></html>` },
      // pág 2: findNextPage → sin "Siguiente"
      { html: `<html><body><a href="/taller-2">Taller 2</a></body></html>` },
    ]);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractLinksAllPages('https://example.com/actividades');
    const urls = links.map(l => l.url);
    expect(urls.some(u => u.includes('taller-1'))).toBe(true);
    expect(urls.some(u => u.includes('taller-2'))).toBe(true);
  });

  it('se detiene al alcanzar el límite de maxPages (branch break)', async () => {
    const pageHtml = (n: number, next: number) => `<html><body>
      <a href="/taller-${n}">Taller ${n}</a>
      <a href="/actividades?page=${next}">Siguiente</a>
    </body></html>`;

    mockFetchSequence([
      { html: pageHtml(1, 2) },  // pág 1: extractLinks
      { html: pageHtml(1, 2) },  // pág 1: findNextPage → retorna pág 2
      { html: pageHtml(2, 3) },  // pág 2: extractLinks
      { html: pageHtml(2, 3) },  // pág 2: findNextPage → retorna pág 3 (pero maxPages=2)
    ]);

    const extractor = new CheerioExtractor();
    const links = await extractor.extractLinksAllPages('https://example.com/actividades', 2);
    const urls = links.map(l => l.url);

    expect(urls.some(u => u.includes('taller-1'))).toBe(true);
    expect(urls.some(u => u.includes('taller-2'))).toBe(true);
    expect(urls.some(u => u.includes('taller-3'))).toBe(false);
  });

});

// ── extractSitemapLinks() ─────────────────────────────────────────────────────

const SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>`;

const SITEMAP_PAGE_1 = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/bogota/actividad/taller-pintura</loc></url>
  <url><loc>https://example.com/bogota/actividad/curso-musica</loc></url>
  <url><loc>https://example.com/nosotros</loc></url>
</urlset>`;

const SITEMAP_PAGE_2 = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/bogota/actividad/obra-teatro</loc></url>
  <url><loc>https://example.com/contacto</loc></url>
</urlset>`;

const SITEMAP_PLAIN = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/actividad/taller-1</loc></url>
  <url><loc>https://example.com/actividad/taller-2</loc></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;

describe('CheerioExtractor.extractSitemapLinks()', () => {
  it('parsea sitemap index y recopila URLs de todos los sub-sitemaps', async () => {
    mockFetchSequence([
      { html: SITEMAP_INDEX },
      { html: SITEMAP_PAGE_1 },
      { html: SITEMAP_PAGE_2 },
    ]);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractSitemapLinks('https://example.com/sitemap.xml');
    const urls = links.map(l => l.url);
    expect(urls).toContain('https://example.com/bogota/actividad/taller-pintura');
    expect(urls).toContain('https://example.com/bogota/actividad/obra-teatro');
    expect(urls).toContain('https://example.com/nosotros');
    expect(links.length).toBe(5);
  });

  it('parsea sitemap plano (sin índice) directamente', async () => {
    mockFetch(SITEMAP_PLAIN);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractSitemapLinks('https://example.com/sitemap.xml');
    expect(links.length).toBe(3);
    expect(links.some(l => l.url.includes('taller-1'))).toBe(true);
    expect(links.some(l => l.url.includes('about'))).toBe(true);
  });

  it('filtra por urlPatterns cuando se proporcionan', async () => {
    mockFetchSequence([
      { html: SITEMAP_INDEX },
      { html: SITEMAP_PAGE_1 },
      { html: SITEMAP_PAGE_2 },
    ]);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractSitemapLinks('https://example.com/sitemap.xml', ['/bogota/actividad/']);
    const urls = links.map(l => l.url);
    expect(urls.every(u => u.includes('/bogota/actividad/'))).toBe(true);
    expect(urls).not.toContain('https://example.com/nosotros');
    expect(urls).not.toContain('https://example.com/contacto');
    expect(links.length).toBe(3);
  });

  it('sin patrones devuelve todas las URLs', async () => {
    mockFetch(SITEMAP_PLAIN);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractSitemapLinks('https://example.com/sitemap.xml', []);
    expect(links.length).toBe(3);
  });

  it('deduplica URLs repetidas entre sub-sitemaps', async () => {
    const duplicateSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset><url><loc>https://example.com/taller</loc></url><url><loc>https://example.com/taller</loc></url></urlset>`;
    mockFetch(duplicateSitemap);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractSitemapLinks('https://example.com/sitemap.xml');
    expect(links.length).toBe(1);
  });

  it('lanza error si el fetch del sitemap raíz falla', async () => {
    mockFetch('', false, 404);
    const extractor = new CheerioExtractor();
    await expect(extractor.extractSitemapLinks('https://example.com/sitemap.xml'))
      .rejects.toThrow('HTTP 404');
  });

  it('continúa si un sub-sitemap falla (warn y sigue)', async () => {
    mockFetchSequence([
      { html: SITEMAP_INDEX },
      { html: '', ok: false }, // sitemap-1 falla
      { html: SITEMAP_PAGE_2 },
    ]);
    const extractor = new CheerioExtractor();
    const links = await extractor.extractSitemapLinks('https://example.com/sitemap.xml');
    // Solo URLs del sitemap-2 que sí cargó
    expect(links.some(l => l.url.includes('obra-teatro'))).toBe(true);
    expect(links.some(l => l.url.includes('taller-pintura'))).toBe(false);
  });
});
