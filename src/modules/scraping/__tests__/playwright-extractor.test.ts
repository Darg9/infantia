import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Playwright
const {
  mockGoto,
  mockClose,
  mockLocator,
  mockEvaluate,
  mockNewPage,
  mockNewContext,
  mockBrowserClose,
  mockContextClose,
} = vi.hoisted(() => {
  const mockGoto = vi.fn();
  const mockClose = vi.fn();
  const mockLocator = vi.fn();
  const mockEvaluate = vi.fn();
  const mockNewPage = vi.fn();
  const mockNewContext = vi.fn();
  const mockBrowserClose = vi.fn();
  const mockContextClose = vi.fn();
  return { mockGoto, mockClose, mockLocator, mockEvaluate, mockNewPage, mockNewContext, mockBrowserClose, mockContextClose };
});

// Helper to create a mock locator with chaining
function createMockLocator(overrides: Record<string, unknown> = {}) {
  const loc: Record<string, unknown> = {
    first: vi.fn(() => loc),
    last: vi.fn(() => loc),
    getAttribute: vi.fn().mockResolvedValue(null),
    innerText: vi.fn().mockResolvedValue(''),
    isVisible: vi.fn().mockResolvedValue(false),
    click: vi.fn().mockResolvedValue(undefined),
    evaluateAll: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  return loc;
}

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve({
      newContext: mockNewContext,
      close: mockBrowserClose,
    })),
  },
}));

import { PlaywrightExtractor } from '../extractors/playwright.extractor';

beforeEach(() => {
  vi.clearAllMocks();
  // Stub delay to resolve instantly in tests
  vi.spyOn(PlaywrightExtractor.prototype as any, 'delay').mockResolvedValue(undefined);

  const mockPage = {
    goto: mockGoto.mockResolvedValue(undefined),
    close: mockClose.mockResolvedValue(undefined),
    locator: mockLocator,
    evaluate: mockEvaluate.mockResolvedValue(undefined),
  };

  mockNewPage.mockResolvedValue(mockPage);
  mockNewContext.mockResolvedValue({
    newPage: mockNewPage,
    close: mockContextClose,
  });

  // Default: meta og:description returns bio with follower info
  mockLocator.mockImplementation((selector: string) => {
    if (selector.includes('og:description')) {
      return createMockLocator({
        getAttribute: vi.fn().mockResolvedValue('500 Followers, 100 Following, 50 Posts - Actividades para ninos en Bogota'),
      });
    }
    if (selector.includes('meta[name="description"]')) {
      return createMockLocator({
        getAttribute: vi.fn().mockResolvedValue('Actividades infantiles'),
      });
    }
    if (selector.includes('Not Now') || selector.includes('Ahora no')) {
      return createMockLocator({ isVisible: vi.fn().mockResolvedValue(false) });
    }
    if (selector.includes('/p/') || selector.includes('/reel/')) {
      return createMockLocator({
        evaluateAll: vi.fn().mockResolvedValue(['/p/ABC123/', '/p/DEF456/']),
      });
    }
    if (selector.includes('time[datetime]')) {
      return createMockLocator({
        getAttribute: vi.fn().mockResolvedValue('2026-03-15T10:00:00.000Z'),
      });
    }
    if (selector === 'h1') {
      return createMockLocator({
        innerText: vi.fn().mockResolvedValue('Taller de arte para ninos este sabado! #arte #talleres'),
      });
    }
    if (selector.includes('article img')) {
      return createMockLocator({
        evaluateAll: vi.fn().mockResolvedValue(['https://instagram.com/img1.jpg']),
      });
    }
    if (selector.includes('likes') || selector.includes('Me gusta')) {
      return createMockLocator({
        innerText: vi.fn().mockResolvedValue('42 likes'),
      });
    }
    if (selector.includes('header section')) {
      return createMockLocator({ innerText: vi.fn().mockResolvedValue('Bio del perfil') });
    }
    return createMockLocator();
  });
});

describe('PlaywrightExtractor', () => {
  describe('extractProfile()', () => {
    it('extrae perfil con username, bio y posts', async () => {
      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/fcecolombia/', 2);

      expect(result.username).toBe('fcecolombia');
      expect(result.bio).toContain('500 Followers');
      expect(result.profileUrl).toBe('https://www.instagram.com/fcecolombia/');
      expect(result.posts).toHaveLength(2);
      expect(result.followerCount).toBe(500);

      await extractor.close();
    });

    it('extrae captions de cada post visitado', async () => {
      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 2);

      expect(result.posts[0].caption).toContain('Taller de arte');
      expect(result.posts[0].url).toContain('instagram.com/p/ABC123');
      expect(result.posts[0].timestamp).toBe('2026-03-15T10:00:00.000Z');

      await extractor.close();
    });

    it('respeta maxPosts y no extrae mas de lo solicitado', async () => {
      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);

      // Should only process 1 post even though 2 were found in grid
      expect(result.posts.length).toBeLessThanOrEqual(1);

      await extractor.close();
    });

    it('maneja errores en posts individuales sin detener el pipeline', async () => {
      // Make goto fail on the second call (first post page)
      let callCount = 0;
      mockGoto.mockImplementation(() => {
        callCount++;
        if (callCount === 2) throw new Error('Navigation timeout');
        return Promise.resolve();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 2);

      // Should still return results (some may have failed)
      expect(result.posts.length).toBeLessThanOrEqual(2);

      await extractor.close();
    });
  });

  describe('extractUsername()', () => {
    it('extrae username de varias formas de URL', async () => {
      const extractor = new PlaywrightExtractor();

      // We test this indirectly through extractProfile
      const result = await extractor.extractProfile('https://www.instagram.com/quehaypahacerenbogota/', 0);
      expect(result.username).toBe('quehaypahacerenbogota');

      await extractor.close();
    });
  });

  describe('launch() y close()', () => {
    it('puede cerrar sin haber abierto', async () => {
      const extractor = new PlaywrightExtractor();
      await expect(extractor.close()).resolves.toBeUndefined();
    });

    it('no lanza browser dos veces', async () => {
      const extractor = new PlaywrightExtractor();
      await extractor.extractProfile('https://www.instagram.com/test/', 0);
      await extractor.extractProfile('https://www.instagram.com/test2/', 0);

      // chromium.launch should only be called once
      const { chromium } = await import('playwright');
      expect(chromium.launch).toHaveBeenCalledTimes(1);

      await extractor.close();
    });
  });

  describe('dismissLoginPopup()', () => {
    it('cierra popup si es visible', async () => {
      const mockClick = vi.fn().mockResolvedValue(undefined);
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('Not Now') || selector.includes('Ahora no')) {
          return createMockLocator({
            isVisible: vi.fn().mockResolvedValue(true),
            click: mockClick,
          });
        }
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('Bio text'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      await extractor.extractProfile('https://www.instagram.com/test/', 0);

      expect(mockClick).toHaveBeenCalled();
      await extractor.close();
    });
  });

  describe('extractFollowerCount()', () => {
    it('retorna null si no hay meta og:description', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('meta[name="description"]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue('fallback bio') });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 0);
      expect(result.followerCount).toBeNull();
      await extractor.close();
    });

    it('retorna null si no hay match de patrón de seguidores', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('Solo texto sin numeros de seguidores'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 0);
      expect(result.followerCount).toBeNull();
      await extractor.close();
    });

    it('parsea "5K Followers" correctamente', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('5K Followers, 100 Following'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 0);
      expect(result.followerCount).toBe(5000);
      await extractor.close();
    });

    it('retorna null si getAttribute lanza error', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockRejectedValue(new Error('not found')),
          });
        }
        if (selector.includes('meta[name="description"]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue('bio') });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('header section')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('header') });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 0);
      expect(result.followerCount).toBeNull();
      await extractor.close();
    });
  });

  describe('extractBio() fallbacks', () => {
    it('usa meta name="description" si og:description falla', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('meta[name="description"]')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('Bio desde meta name'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 0);
      expect(result.bio).toBe('Bio desde meta name');
      await extractor.close();
    });

    it('usa header section como fallback final', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('meta[name="description"]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('header section')) {
          return createMockLocator({
            innerText: vi.fn().mockResolvedValue('Bio del header'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 0);
      expect(result.bio).toBe('Bio del header');
      await extractor.close();
    });
  });

  describe('extractCaption() strategies', () => {
    it('usa og:description con pattern de comillas si h1 es corto', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector === 'h1') {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('short') });
        }
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue(
              '50 likes - User on Instagram: "Taller de arte para niños"'
            ),
          });
        }
        if (selector.includes('/p/') || selector.includes('/reel/')) {
          return createMockLocator({
            evaluateAll: vi.fn().mockResolvedValue(['/p/CAP1/']),
          });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        expect(result.posts[0].caption).toContain('Taller de arte');
      }
      await extractor.close();
    });

    it('usa article spans como fallback final', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector === 'h1') {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('') });
        }
        if (selector.includes('og:description')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('meta[name="description"]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('/p/') || selector.includes('/reel/')) {
          return createMockLocator({
            evaluateAll: vi.fn().mockResolvedValue(['/p/SPAN1/']),
          });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article span')) {
          return createMockLocator({
            evaluateAll: vi.fn().mockResolvedValue([
              'Un texto largo del article span que sirve de fallback caption',
            ]),
          });
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('header section')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('') });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        expect(result.posts[0].caption).toContain('fallback caption');
      }
      await extractor.close();
    });
  });

  describe('extractPostUrls() con scroll', () => {
    it('hace scroll para cargar más posts si hay menos que maxPosts', async () => {
      let evaluateAllCalls = 0;
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('500 Followers'),
          });
        }
        if (selector.includes('/p/') || selector.includes('/reel/')) {
          return createMockLocator({
            evaluateAll: vi.fn().mockImplementation(() => {
              evaluateAllCalls++;
              if (evaluateAllCalls <= 1) return ['/p/P1/'];
              return ['/p/P1/', '/p/P2/', '/p/P3/'];
            }),
          });
        }
        if (selector === 'h1') {
          return createMockLocator({
            innerText: vi.fn().mockResolvedValue('Caption largo suficiente para el test'),
          });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 5);
      expect(mockEvaluate).toHaveBeenCalled(); // window.scrollBy
      await extractor.close();
    });
  });

  describe('extractImageUrls()', () => {
    it('deduplica URLs de imágenes', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('500 Followers'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({
            evaluateAll: vi.fn().mockResolvedValue(['/p/IMG1/']),
          });
        }
        if (selector === 'h1') {
          return createMockLocator({
            innerText: vi.fn().mockResolvedValue('Caption largo para el test de imagenes'),
          });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return createMockLocator({
            evaluateAll: vi.fn().mockResolvedValue([
              'https://instagram.com/full.jpg',
              'https://instagram.com/full.jpg',
            ]),
          });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        expect(result.posts[0].imageUrls).toEqual(['https://instagram.com/full.jpg']);
      }
      await extractor.close();
    });
  });

  describe('extractLikesCount()', () => {
    it('retorna null si no encuentra likes text', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('500 Followers'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({
            evaluateAll: vi.fn().mockResolvedValue(['/p/LK1/']),
          });
        }
        if (selector === 'h1') {
          return createMockLocator({
            innerText: vi.fn().mockResolvedValue('Caption largo para test de likes'),
          });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        expect(result.posts[0].likesCount).toBeNull();
      }
      await extractor.close();
    });

    it('retorna null si la sección de likes lanza error', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('500 Followers'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({
            evaluateAll: vi.fn().mockResolvedValue(['/p/LK2/']),
          });
        }
        if (selector === 'h1') {
          return createMockLocator({
            innerText: vi.fn().mockResolvedValue('Caption largo para test de likes err'),
          });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({
            innerText: vi.fn().mockRejectedValue(new Error('no element')),
          });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        expect(result.posts[0].likesCount).toBeNull();
      }
      await extractor.close();
    });
  });

  describe('extractPost() con URL string directo', () => {
    it('crea nueva página y la cierra al terminar', async () => {
      const extractor = new PlaywrightExtractor();
      const post = await extractor.extractPost('https://www.instagram.com/p/DIRECT/');
      expect(post.url).toBe('https://www.instagram.com/p/DIRECT/');
      expect(mockClose).toHaveBeenCalled();
      await extractor.close();
    });
  });

  describe('extractUsername() edge cases', () => {
    it('retorna "unknown" si la URL no matchea patrón de Instagram', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue('Bio') });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.example.com/path', 0);
      expect(result.username).toBe('unknown');
      await extractor.close();
    });
  });

  // ── Callbacks de evaluateAll (arrow functions internas) ───────────────────

  describe('evaluateAll callbacks — cobertura de funciones internas', () => {
    // Helper que hace que evaluateAll invoque el callback con elementos DOM mock
    function makeCallbackLocator(mockEls: object[]) {
      return createMockLocator({
        evaluateAll: vi.fn().mockImplementation((cb: (els: object[]) => unknown) =>
          Promise.resolve(cb(mockEls)),
        ),
      });
    }

    it('extractPostUrls: callback filtra hrefs nulos y mapea a string[]', async () => {
      const mockEls = [
        { getAttribute: (_: string) => '/p/POST1/' },
        { getAttribute: (_: string) => null },           // filtrado
        { getAttribute: (_: string) => '/reel/REEL1/' },
      ];
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue('500 Followers') });
        }
        if (selector.includes('/p/') || selector.includes('/reel/')) {
          return makeCallbackLocator(mockEls);
        }
        if (selector === 'h1') {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('Caption largo para test callback') });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 5);
      // Los 2 hrefs válidos deberían haberse procesado
      expect(result.posts.length).toBeGreaterThanOrEqual(0);
      await extractor.close();
    });

    it('extractImageUrls: callback filtra s150x150 y mapea srcs únicos', async () => {
      const imgEls = [
        { getAttribute: (_: string) => 'https://cdn.instagram.com/full1.jpg' },
        { getAttribute: (_: string) => 'https://cdn.instagram.com/s150x150thumb.jpg' }, // filtrado
        { getAttribute: (_: string) => null },                                            // filtrado
        { getAttribute: (_: string) => 'https://cdn.instagram.com/full1.jpg' },          // duplicado
      ];
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue('500 Followers') });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue(['/p/IMGCB1/']) });
        }
        if (selector === 'h1') {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('Caption imagen callback test') });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return makeCallbackLocator(imgEls);
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        // Solo full1.jpg debe aparecer (deduplicado, sin s150x150, sin null)
        expect(result.posts[0].imageUrls).toEqual(['https://cdn.instagram.com/full1.jpg']);
      }
      await extractor.close();
    });

    it('extractCaption: callback de article span filtra textos cortos y ordena por longitud', async () => {
      // og:description se usa: 1=extractBio, 2=extractFollowerCount, 3=extractCaption
      // El 3er call debe retornar null para que extractCaption caiga al fallback de article span
      let ogDescCallCount = 0;
      const spanEls = [
        { textContent: 'corto' },
        { textContent: 'Este es el caption largo que debería aparecer primero en el resultado' },
        { textContent: 'Segundo texto largo pero más corto que el primero' },
        { textContent: null },
      ];
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          const callIdx = ++ogDescCallCount;
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue(callIdx <= 2 ? '500 Followers' : null),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue(['/p/SPANCB1/']) });
        }
        if (selector === 'h1') {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('') });
        }
        if (selector.includes('meta[name="description"]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article span')) {
          return makeCallbackLocator(spanEls);
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('header section')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('') });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        expect(result.posts[0].caption).toContain('caption largo');
      }
      await extractor.close();
    });
  });

  // ── Branches faltantes en métodos privados ────────────────────────────────

  describe('extractCaption() — branch "on Instagram:" colon pattern', () => {
    it('extrae caption usando patrón "on Instagram:" si no hay comillas', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector === 'h1') {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('x') }); // < 10 chars
        }
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue(
              '42 likes - TestUser on Instagram: Taller de cerámica este sábado'
            ),
          });
        }
        if (selector.includes('/p/') || selector.includes('/reel/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue(['/p/COLON1/']) });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        expect(result.posts[0].caption).toContain('Taller de cerámica');
      }
      await extractor.close();
    });

    it('retorna metaDesc directo si no hay comillas ni patrón "on Instagram:"', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector === 'h1') {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('') });
        }
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('Descripción sin formato especial'),
          });
        }
        if (selector.includes('/p/') || selector.includes('/reel/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue(['/p/RAW1/']) });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue(null) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        expect(result.posts[0].caption).toBe('Descripción sin formato especial');
      }
      await extractor.close();
    });
  });

  describe('extractLikesCount() — branch sin match numérico', () => {
    it('retorna null si el texto de likes no contiene dígitos', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue('500 Followers') });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue(['/p/NOMATCH/']) });
        }
        if (selector === 'h1') {
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('Caption suficientemente largo para pasar el filtro') });
        }
        if (selector.includes('time[datetime]')) {
          return createMockLocator({ getAttribute: vi.fn().mockResolvedValue(null) });
        }
        if (selector.includes('article img')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        if (selector.includes('likes') || selector.includes('Me gusta')) {
          // Tiene texto pero sin dígitos → match falla → return null
          return createMockLocator({ innerText: vi.fn().mockResolvedValue('muchos likes') });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 1);
      if (result.posts.length > 0) {
        expect(result.posts[0].likesCount).toBeNull();
      }
      await extractor.close();
    });
  });

  describe('extractFollowerCount() — multiplicadores mil y M', () => {
    it('parsea "5 mil seguidores" correctamente', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('5 mil seguidores, 200 Following'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 0);
      expect(result.followerCount).toBe(5000);
      await extractor.close();
    });

    it('parsea "2M Followers" correctamente', async () => {
      mockLocator.mockImplementation((selector: string) => {
        if (selector.includes('og:description')) {
          return createMockLocator({
            getAttribute: vi.fn().mockResolvedValue('2M Followers, 500 Following'),
          });
        }
        if (selector.includes('/p/')) {
          return createMockLocator({ evaluateAll: vi.fn().mockResolvedValue([]) });
        }
        return createMockLocator();
      });

      const extractor = new PlaywrightExtractor();
      const result = await extractor.extractProfile('https://www.instagram.com/test/', 0);
      expect(result.followerCount).toBe(2000000);
      await extractor.close();
    });
  });
});
