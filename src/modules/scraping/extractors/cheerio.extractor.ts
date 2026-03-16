import * as cheerio from 'cheerio';
import { Extractor, ScrapedRawData, DiscoveredLink } from '../types';

export class CheerioExtractor implements Extractor {
  async extract(url: string): Promise<ScrapedRawData> {
    try {
      const response = await fetch(url, {
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

      // Limpiar etiquetas ruidosas
      $('script, style, noscript, iframe, svg, path, nav, footer, header').remove();

      // Extraer texto limpio
      // text() en cheerio elimina los tags HTML, nos deja el "texto crudo"
      const rawText = $('body').text();
      
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
}
