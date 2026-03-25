import { existsSync } from 'fs';
import { resolve } from 'path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { InstagramPost, InstagramProfileData, DiscoveredLink, ScrapedRawData } from '../types';

// Desktop UA — Instagram shows posts without login on desktop but blocks mobile
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

/** Path where Instagram session cookies are stored */
const SESSION_FILE = resolve(process.cwd(), 'data', 'ig-session.json');

export class PlaywrightExtractor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async launch(): Promise<void> {
    if (this.browser) return;
    this.browser = await chromium.launch({ headless: true });

    const contextOptions: Parameters<Browser['newContext']>[0] = {
      userAgent: DESKTOP_USER_AGENT,
      viewport: DESKTOP_VIEWPORT,
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
    };

    // Load saved session if available
    if (existsSync(SESSION_FILE)) {
      contextOptions.storageState = SESSION_FILE;
      console.log('[PLAYWRIGHT] Sesión de Instagram cargada desde ig-session.json');
    } else {
      console.warn('[PLAYWRIGHT] No se encontró ig-session.json. Ejecuta: npx tsx scripts/ig-login.ts');
    }

    this.context = await this.browser.newContext(contextOptions);
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /** Random delay between min and max ms. Overridable in tests. */
  protected delay(minMs: number, maxMs: number): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Extract profile data and posts from a public Instagram profile.
   * Navigates to the profile, extracts bio, then visits individual posts.
   */
  async extractProfile(profileUrl: string, maxPosts: number = 12): Promise<InstagramProfileData> {
    await this.launch();
    const page = await this.context!.newPage();

    try {
      console.log(`[PLAYWRIGHT] Navegando a perfil: ${profileUrl}`);
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Wait for Instagram SPA to render post grid
      await this.delay(4000, 6000);

      // Handle login popup if it appears
      await this.dismissLoginPopup(page);

      // Extract username from URL
      const username = this.extractUsername(profileUrl);

      // Extract profile bio from meta tags (works without login)
      const bio = await this.extractBio(page);
      console.log(`[PLAYWRIGHT] Bio extraída: ${bio.substring(0, 100)}...`);

      // Extract follower count from meta description
      const followerCount = await this.extractFollowerCount(page);

      // Collect post URLs from the profile grid
      const postUrls = await this.extractPostUrls(page, maxPosts);
      console.log(`[PLAYWRIGHT] Posts encontrados en grid: ${postUrls.length}`);

      // Visit each post to extract full data
      const posts: InstagramPost[] = [];
      for (const postUrl of postUrls) {
        try {
          await this.delay(2000, 5000);
          const post = await this.extractPost(page, postUrl);
          posts.push(post);
          console.log(`[PLAYWRIGHT] Post extraído: ${postUrl} (caption: ${post.caption.substring(0, 60)}...)`);
        } catch (error: any) {
          console.error(`[PLAYWRIGHT] Error en post ${postUrl}: ${error.message}`);
        }
      }

      return {
        username,
        bio,
        followerCount,
        posts,
        profileUrl,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Extract data from a single Instagram post page.
   */
  async extractPost(pageOrUrl: Page | string, postUrl?: string): Promise<InstagramPost> {
    let page: Page;
    let shouldClosePage = false;

    if (typeof pageOrUrl === 'string') {
      // Called directly with a URL string
      await this.launch();
      page = await this.context!.newPage();
      shouldClosePage = true;
      postUrl = pageOrUrl;
    } else {
      page = pageOrUrl;
    }

    try {
      const url = postUrl!;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.delay(1000, 3000);
      await this.dismissLoginPopup(page);

      // Extract caption - try multiple selectors (Instagram changes these frequently)
      const caption = await this.extractCaption(page);

      // Extract image URLs
      const imageUrls = await this.extractImageUrls(page);

      // Extract timestamp
      const timestamp = await page
        .locator('time[datetime]')
        .first()
        .getAttribute('datetime')
        .catch(() => null);

      // Extract likes count from meta or aria-label
      const likesCount = await this.extractLikesCount(page);

      return {
        url,
        caption,
        imageUrls,
        timestamp,
        likesCount,
      };
    } finally {
      if (shouldClosePage) {
        await page.close();
      }
    }
  }

  // ── Private helpers ──

  private extractUsername(profileUrl: string): string {
    const match = profileUrl.match(/instagram\.com\/([^/?#]+)/);
    return match?.[1] ?? 'unknown';
  }

  private async dismissLoginPopup(page: Page): Promise<void> {
    try {
      // Instagram shows "Log in" popups - look for dismiss/close buttons
      const closeButton = page.locator('button:has-text("Not Now"), button:has-text("Ahora no"), [aria-label="Close"], [aria-label="Cerrar"]');
      if (await closeButton.first().isVisible({ timeout: 2000 })) {
        await closeButton.first().click();
        await this.delay(500, 1000);
      }
    } catch {
      // No popup to dismiss
    }
  }

  private async extractBio(page: Page): Promise<string> {
    // Strategy 1: meta description (most reliable for public profiles)
    const metaDesc = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content')
      .catch(() => null);
    if (metaDesc) return metaDesc;

    // Strategy 2: meta name description
    const metaName = await page
      .locator('meta[name="description"]')
      .getAttribute('content')
      .catch(() => null);
    if (metaName) return metaName;

    // Strategy 3: header section text
    const headerText = await page
      .locator('header section')
      .last()
      .innerText()
      .catch(() => '');

    return headerText;
  }

  private async extractFollowerCount(page: Page): Promise<number | null> {
    try {
      const metaDesc = await page
        .locator('meta[property="og:description"]')
        .getAttribute('content');
      if (!metaDesc) return null;

      // Pattern: "123K Followers, 456 Following, 789 Posts"
      // or Spanish: "123 mil seguidores"
      const match = metaDesc.match(/([\d,.]+)\s*(?:K|mil|M)?\s*(?:Followers|seguidores)/i);
      if (!match) return null;

      let count = parseFloat(match[1].replace(/,/g, ''));
      if (metaDesc.toLowerCase().includes('k ')) count *= 1000;
      if (metaDesc.toLowerCase().includes('m ')) count *= 1000000;
      if (metaDesc.toLowerCase().includes('mil ')) count *= 1000;
      return Math.round(count);
    } catch {
      return null;
    }
  }

  private async extractPostUrls(page: Page, maxPosts: number): Promise<string[]> {
    // Strategy 1: links inside article grid
    const postLinks = await page
      .locator('a[href*="/p/"], a[href*="/reel/"]')
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute('href')).filter((h): h is string => !!h),
      );

    const uniqueUrls = [...new Set(postLinks)]
      .map((href) => {
        if (href.startsWith('/')) return `https://www.instagram.com${href}`;
        return href;
      })
      .slice(0, maxPosts);

    // If we got fewer than maxPosts, try scrolling once to load more
    if (uniqueUrls.length < maxPosts) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await this.delay(2000, 3000);

      const moreLinks = await page
        .locator('a[href*="/p/"], a[href*="/reel/"]')
        .evaluateAll((els) =>
          els.map((el) => el.getAttribute('href')).filter((h): h is string => !!h),
        );

      for (const href of moreLinks) {
        const fullUrl = href.startsWith('/') ? `https://www.instagram.com${href}` : href;
        if (!uniqueUrls.includes(fullUrl) && uniqueUrls.length < maxPosts) {
          uniqueUrls.push(fullUrl);
        }
      }
    }

    return uniqueUrls;
  }

  private async extractCaption(page: Page): Promise<string> {
    // Strategy 1: h1 element (common in post pages)
    const h1Text = await page
      .locator('h1')
      .first()
      .innerText()
      .catch(() => '');
    if (h1Text && h1Text.length > 10) return h1Text;

    // Strategy 2: meta og:description
    const metaDesc = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content')
      .catch(() => null);
    if (metaDesc) {
      // Format: "N likes, N comments - Username on Instagram: \"caption text\""
      const captionMatch = metaDesc.match(/["""](.+)["""]/);
      if (captionMatch) return captionMatch[1];
      // Some formats use ": " as separator
      const colonMatch = metaDesc.match(/on Instagram:\s*(.+)/);
      if (colonMatch) return colonMatch[1].replace(/^[""]|[""]$/g, '');
      return metaDesc;
    }

    // Strategy 3: span elements inside article (fallback)
    const articleText = await page
      .locator('article span')
      .evaluateAll((els) =>
        els
          .map((el) => el.textContent?.trim() ?? '')
          .filter((t) => t.length > 20)
          .sort((a, b) => b.length - a.length),
      );

    return articleText[0] ?? '';
  }

  private async extractImageUrls(page: Page): Promise<string[]> {
    const imgs = await page
      .locator('article img[src]')
      .evaluateAll((els) =>
        els
          .map((el) => el.getAttribute('src'))
          .filter((s): s is string => !!s && !s.includes('s150x150')),
      );

    return [...new Set(imgs)];
  }

  /**
   * Extract links from a SPA/JS-rendered page (non-Instagram).
   * Launches a fresh browser context without Instagram session.
   */
  async extractWebLinks(url: string): Promise<DiscoveredLink[]> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: DESKTOP_USER_AGENT,
      viewport: DESKTOP_VIEWPORT,
      locale: 'es-CO',
    });
    const page = await context.newPage();
    try {
      console.log(`[PLAYWRIGHT-WEB] Navegando a: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.delay(6000, 8000);

      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]')).map((el) => ({
          url: (el as HTMLAnchorElement).href,
          anchorText: (el.textContent ?? '').trim().substring(0, 200),
        }));
      });

      // Deduplicar y filtrar vacíos
      const seen = new Set<string>();
      return links.filter((l) => {
        if (!l.url || seen.has(l.url)) return false;
        seen.add(l.url);
        return true;
      });
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
  }

  /**
   * Extract text content from a SPA/JS-rendered page (non-Instagram).
   */
  async extractWebText(url: string): Promise<ScrapedRawData> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: DESKTOP_USER_AGENT,
      viewport: DESKTOP_VIEWPORT,
      locale: 'es-CO',
    });
    const page = await context.newPage();
    try {
      console.log(`[PLAYWRIGHT-WEB] Extrayendo texto de: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.delay(2000, 3000);

      const text = await page.evaluate(() => {
        // Eliminar nav, footer, scripts
        document.querySelectorAll('nav, footer, script, style, noscript, svg').forEach((el) => el.remove());
        return (document.body?.innerText ?? '').replace(/\s\s+/g, ' ').trim();
      });

      return {
        url,
        sourceText: text,
        html: await page.content(),
        extractedAt: new Date(),
        status: text.length > 50 ? 'SUCCESS' : 'FAILED',
        error: text.length <= 50 ? 'Texto insuficiente extraído por Playwright' : undefined,
      };
    } catch (error: any) {
      return { url, sourceText: '', html: '', extractedAt: new Date(), status: 'FAILED', error: error.message };
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
  }

  private async extractLikesCount(page: Page): Promise<number | null> {
    try {
      // Look for likes in aria-label or text content
      const likesText = await page
        .locator('section span:has-text("likes"), section span:has-text("Me gusta")')
        .first()
        .innerText()
        .catch(() => null);

      if (!likesText) return null;

      const match = likesText.match(/([\d,. ]+)/);
      if (!match) return null;

      return parseInt(match[1].replace(/[,. ]/g, ''), 10) || null;
    } catch {
      return null;
    }
  }
}
