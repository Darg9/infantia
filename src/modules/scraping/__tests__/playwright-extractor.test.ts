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
});
