import * as cheerio from 'cheerio';
import { Agent } from 'undici';
import { Extractor, ScrapedRawData, DiscoveredLink } from '../types';

// Algunos sitios .gov.co tienen cadena SSL incompleta (UNABLE_TO_VERIFY_LEAF_SIGNATURE).
// Node.js 24 (undici) los rechaza. Para dominios conocidos usamos dispatcher relajado.
const RELAXED_TLS_DOMAINS = ['jbb.gov.co', 'cinematecadebogota.gov.co', 'planetariodebogota.gov.co'];
const relaxedDispatcher = new Agent({ connect: { rejectUnauthorized: false } });

function fetchOptions(url: string): RequestInit {
  try {
    const host = new URL(url).hostname;
    if (RELAXED_TLS_DOMAINS.some((d) => host.endsWith(d))) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — dispatcher es undici (Node.js 18+), no está en tipos DOM fetch
      return { dispatcher: relaxedDispatcher } as RequestInit;
    }
  } catch { /* url inválida */ }
  return {};
}

export class CheerioExtractor implements Extractor {
  async extract(url: string): Promise<ScrapedRawData> {
    try {
      const response = await fetch(url, {
        ...fetchOptions(url),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'es-ES,es;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extraer JSON-LD ANTES de eliminar scripts (mejora calidad de extracción)
      let jsonLdText = '';
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const raw = $(el).html() ?? '';
          const data = JSON.parse(raw);
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Event' || item['@type'] === 'Article') {
              jsonLdText += `\n[DATOS ESTRUCTURADOS JSON-LD]\n${JSON.stringify(item, null, 2)}\n[FIN DATOS ESTRUCTURADOS]\n`;
            }
          }
        } catch { /* ignorar JSON-LD inválido */ }
      });

      // Limpiar etiquetas ruidosas
      $('script, style, noscript, iframe, svg, path, nav, footer, header').remove();

      // Extraer texto limpio
      // text() en cheerio elimina los tags HTML, nos deja el "texto crudo"
      const rawText = (jsonLdText + '\n' + $('body').text());
      
      // Limpiar un poco los saltos de línea y espacios en blanco extremos
      const cleanText = rawText
        .replace(/\s\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

      return {
        url,
        sourceText: cleanText,
        html,
        extractedAt: new Date(),
        status: 'SUCCESS',
      };
    } catch (error: any) {
      return {
        url,
        sourceText: '',
        extractedAt: new Date(),
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  async extractLinks(url: string): Promise<DiscoveredLink[]> {
    const response = await fetch(url, {
      ...fetchOptions(url),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(url);
    const seen = new Set<string>();
    const links: DiscoveredLink[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // Ignorar anchors, mailto, javascript, tel
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:') || href.startsWith('tel:')) return;

      // Resolver URL relativa a absoluta
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, url).href;
      } catch {
        return;
      }

      // Solo links del mismo dominio
      try {
        const linkHost = new URL(absoluteUrl).hostname;
        if (linkHost !== baseUrl.hostname) return;
      } catch {
        return;
      }

      // Eliminar fragment y trailing slash para deduplicar
      const clean = absoluteUrl.split('#')[0].replace(/\/$/, '');
      if (seen.has(clean)) return;
      seen.add(clean);

      // Ignorar la propia URL de listado
      if (clean === url.replace(/\/$/, '')) return;

      const anchorText = $(el).text().replace(/\s+/g, ' ').trim();
      links.push({ url: clean, anchorText: anchorText || clean });
    });

    return links;
  }

  async extractLinksAllPages(baseUrl: string, maxPages: number = 50): Promise<DiscoveredLink[]> {
    const allLinks: DiscoveredLink[] = [];
    const seenUrls = new Set<string>();
    let currentUrl = baseUrl;
    let pageNum = 1;

    while (true) {
      console.log(`[CHEERIO] Extrayendo links de página ${pageNum}: ${currentUrl}`);
      const pageLinks = await this.extractLinks(currentUrl);

      let newCount = 0;
      for (const link of pageLinks) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          allLinks.push(link);
          newCount++;
        }
      }
      console.log(`[CHEERIO] Página ${pageNum}: ${newCount} links nuevos (${allLinks.length} total acumulado)`);

      // Buscar link a siguiente página
      const nextPageUrl = await this.findNextPage(currentUrl, pageNum);
      if (!nextPageUrl) {
        console.log(`[CHEERIO] No se encontró página siguiente. Total páginas: ${pageNum}`);
        break;
      }

      currentUrl = nextPageUrl;
      pageNum++;

      // Seguridad: respetar límite de páginas
      if (pageNum > maxPages) {
        console.warn(`[CHEERIO] Límite de ${maxPages} páginas alcanzado.`);
        break;
      }
    }

    return allLinks;
  }

  private async findNextPage(currentUrl: string, currentPage: number): Promise<string | null> {
    const response = await fetch(currentUrl, {
      ...fetchOptions(currentUrl),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(currentUrl);

    // Estrategia 1: Buscar link con texto "Siguiente", "Next", "›", "»"
    const nextPatterns = ['siguiente', 'next', '›', '»', '>>'];
    for (const pattern of nextPatterns) {
      const link = $(`a`).filter((_, el) => {
        const text = $(el).text().trim().toLowerCase();
        return text === pattern || text.includes(pattern);
      }).first();

      if (link.length) {
        const href = link.attr('href');
        if (href) {
          try {
            return new URL(href, currentUrl).href;
          } catch { /* ignorar */ }
        }
      }
    }

    // Estrategia 2: Buscar link con ?page=N+1 o &page=N+1
    const nextPage = currentPage + 1;
    const pageLink = $(`a[href*="page=${nextPage}"]`).first();
    if (pageLink.length) {
      const href = pageLink.attr('href');
      if (href) {
        try {
          return new URL(href, currentUrl).href;
        } catch { /* ignorar */ }
      }
    }

    return null;
  }

  /**
   * Extract all URLs from a sitemap index (XML).
   * Handles both sitemap indexes (with <sitemap> entries) and plain sitemaps (with <url> entries).
   * @param sitemapUrl  URL of the sitemap index (e.g. https://example.com/sitemap.xml)
   * @param urlPatterns Optional array of strings — only URLs containing at least one pattern are returned
   */
  async extractSitemapLinks(sitemapUrl: string, urlPatterns: string[] = []): Promise<DiscoveredLink[]> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'application/xml,text/xml,*/*',
    };

    const fetchXml = async (url: string): Promise<string> => {
      const res = await fetch(url, { ...fetchOptions(url), headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching sitemap: ${url}`);
      return res.text();
    };

    const collectUrls = async (xmlText: string): Promise<string[]> => {
      const $ = cheerio.load(xmlText, { xmlMode: true });
      // Sitemap index: contains <sitemap><loc>...</loc></sitemap>
      const childSitemaps = $('sitemap > loc').map((_, el) => $(el).text().trim()).get();
      if (childSitemaps.length > 0) {
        const nested: string[] = [];
        for (const childUrl of childSitemaps) {
          try {
            const childXml = await fetchXml(childUrl);
            nested.push(...(await collectUrls(childXml)));
          } catch (err: any) {
            console.warn(`[SITEMAP] Error fetching child sitemap ${childUrl}: ${err.message}`);
          }
        }
        return nested;
      }
      // Plain sitemap: contains <url><loc>...</loc></url>
      return $('url > loc').map((_, el) => $(el).text().trim()).get();
    };

    console.log(`[SITEMAP] Leyendo sitemap: ${sitemapUrl}`);
    const xml = await fetchXml(sitemapUrl);
    const allUrls = await collectUrls(xml);
    console.log(`[SITEMAP] Total URLs en sitemap: ${allUrls.length}`);

    const filtered = urlPatterns.length > 0
      ? allUrls.filter((u) => urlPatterns.some((p) => u.includes(p)))
      : allUrls;

    console.log(`[SITEMAP] URLs tras filtro de patrones: ${filtered.length}`);

    const seen = new Set<string>();
    return filtered
      .filter((u) => { if (seen.has(u)) return false; seen.add(u); return true; })
      .map((u) => ({ url: u, anchorText: '' }));
  }
}
