import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma first (before importing the module that uses it)
vi.mock('../db', () => ({
  prisma: {
    city: {
      findUnique: vi.fn(),
    },
    scrapingSource: {
      update: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Now import the module after mocking its dependencies
import {
  resolvePauseConfig,
  calculateSourceScore,
  pauseSourceIfNeeded,
  unpausSourceIfExpired,
  getSourceDashboardStats,
  GLOBAL_PAUSE_CONFIG,
  CITY_PAUSE_CONFIG,
} from '../source-pause-manager';
import { prisma } from '../db';

describe('source-pause-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateSourceScore', () => {
    it('returns null score if no data', async () => {
      (prisma.$queryRawUnsafe as any).mockResolvedValue([]);

      const score = await calculateSourceScore('source-1');

      expect(score.avgScore).toBeNull();
      expect(score.hasData).toBe(false);
    });

    it('calculates average URL score from logs', async () => {
      (prisma.$queryRawUnsafe as any).mockResolvedValue([
        { avg_score: 55.5, total_urls: 100, low_score_urls: 20 },
      ]);

      const score = await calculateSourceScore('source-1', 'city-1', 1);

      expect(score.avgScore).toBe(55.5);
      expect(score.lowScoreCount).toBe(20);
      expect(score.totalUrls).toBe(100);
      expect(score.hasData).toBe(true);
    });

    it('handles null values gracefully', async () => {
      (prisma.$queryRawUnsafe as any).mockResolvedValue([
        { avg_score: null, total_urls: 0, low_score_urls: 0 },
      ]);

      const score = await calculateSourceScore('source-1');

      expect(score.avgScore).toBeNull();
      expect(score.hasData).toBe(true);
    });
  });

  describe('getSourceDashboardStats', () => {
    it('returns stats with proper SQL LEFT JOINs', async () => {
      const mockStats = [
        {
          id: 'src-1',
          name: 'BibloRed',
          platform: 'WEB',
          city_name: 'Bogotá',
          city_id: 'bogota',
          avg_url_score: 75.5,
          low_score_count: 5,
          high_score_count: 95,
          total_urls_processed: 100,
          last_scan_at: new Date().toISOString(),
          paused_at: null,
          paused_reason: null,
          pause_threshold_score: 20,
          pause_duration_days: 7,
          is_active: true,
        },
      ];

      (prisma.$queryRawUnsafe as any).mockResolvedValue(mockStats);

      const stats = await getSourceDashboardStats('bogota');

      expect(stats).toHaveLength(1);
      expect(stats[0].id).toBe('src-1');
      expect(stats[0].avg_url_score).toBe(75.5);
      expect(stats[0].is_active).toBe(true);
    });
  });

  describe('resolvePauseConfig', () => {
    it('returns global config by default', async () => {
      (prisma.$queryRawUnsafe as any).mockResolvedValue([]); // all queries return empty
      (prisma.city.findUnique as any).mockResolvedValue(null);

      const config = await resolvePauseConfig('source-1');

      expect(config.level).toBe('global');
      expect(config.threshold).toBe(GLOBAL_PAUSE_CONFIG.threshold);
    });

    it('returns source-specific config when available', async () => {
      // When no cityId is passed, resolvePauseConfig skips source_city check and goes straight to source check
      const querySequence = [
        [{ pause_threshold_score: 25, pause_duration_days: 14, auto_pause_enabled: true }], // source config check
      ];
      let callIndex = 0;
      (prisma.$queryRawUnsafe as any).mockImplementation(async () => {
        const result = querySequence[callIndex];
        callIndex++;
        return result;
      });

      const config = await resolvePauseConfig('source-1');

      expect(config.level).toBe('source');
      expect(config.threshold).toBe(25);
    });

    it('respects CITY_PAUSE_CONFIG override', async () => {
      const originalConfig = CITY_PAUSE_CONFIG['bogotá'];
      CITY_PAUSE_CONFIG['bogotá'] = { threshold: 28, durationDays: 21 };

      try {
        (prisma.$queryRawUnsafe as any).mockResolvedValue([]);
        (prisma.city.findUnique as any).mockResolvedValue({
          id: 'bogota-id',
          name: 'Bogotá',
          countryCode: 'CO',
          countryName: 'Colombia',
          timezone: 'America/Bogota',
          currency: 'COP',
          isActive: true,
        });

        const config = await resolvePauseConfig('source-1', 'bogota-id');

        expect(config.level).toBe('city');
        expect(config.threshold).toBe(28);
      } finally {
        if (originalConfig) {
          CITY_PAUSE_CONFIG['bogotá'] = originalConfig;
        } else {
          delete CITY_PAUSE_CONFIG['bogotá'];
        }
      }
    });
  });

  describe('pauseSourceIfNeeded', () => {
    it('does not pause if score is above threshold', async () => {
      const querySequence = [
        [], // source config check (no cityId, so no source_city check)
        [{ avg_score: 50, total_urls: 100, low_score_urls: 10 }], // score calculation
      ];
      let callIndex = 0;
      (prisma.$queryRawUnsafe as any).mockImplementation(async () => {
        const result = querySequence[callIndex];
        callIndex++;
        return result;
      });

      const result = await pauseSourceIfNeeded('source-1');

      expect(result.paused).toBe(false);
      expect(result.reason).toBe('score_above_threshold');
      expect(result.score).toBe(50);
    });

    it('pauses source when score is below threshold', async () => {
      const querySequence = [
        [], // source config check (no cityId, so no source_city check)
        [{ avg_score: 15, total_urls: 100, low_score_urls: 80 }], // score calculation
      ];
      let callIndex = 0;
      (prisma.$queryRawUnsafe as any).mockImplementation(async () => {
        const result = querySequence[callIndex];
        callIndex++;
        return result;
      });
      (prisma.$executeRawUnsafe as any).mockResolvedValue({});
      (prisma.scrapingSource.update as any).mockResolvedValue({});

      const result = await pauseSourceIfNeeded('source-1');

      expect(result.paused).toBe(true);
      expect(result.score).toBe(15);
      expect((prisma.scrapingSource.update as any)).toHaveBeenCalled();
    });

    it('respects auto_pause_enabled flag', async () => {
      (prisma.$queryRawUnsafe as any).mockResolvedValueOnce([
        { pause_threshold_score: 20, pause_duration_days: 7, auto_pause_enabled: false },
      ]); // source config with disabled flag

      const result = await pauseSourceIfNeeded('source-1');

      expect(result.paused).toBe(false);
      expect(result.reason).toBe('auto_pause_disabled');
    });
  });

  describe('unpausSourceIfExpired', () => {
    it('does not unpause if pause period is still active', async () => {
      const now = new Date();
      const pausedAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      (prisma.$queryRawUnsafe as any).mockResolvedValue([
        { paused_at: pausedAt.toISOString(), pause_duration_days: 7 },
      ]);

      const result = await unpausSourceIfExpired('source-1');

      expect(result.unpaused).toBe(false);
      expect(result.reason).toBe('pause_still_active');
    });

    it('unpauses source when pause period expires', async () => {
      const now = new Date();
      const pausedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      (prisma.$queryRawUnsafe as any).mockResolvedValue([
        { paused_at: pausedAt.toISOString(), pause_duration_days: 7 },
      ]);
      (prisma.$executeRawUnsafe as any).mockResolvedValue({});
      (prisma.scrapingSource.update as any).mockResolvedValue({});

      const result = await unpausSourceIfExpired('source-1');

      expect(result.unpaused).toBe(true);
      expect(result.pausedFor).toBe(7);
      expect((prisma.scrapingSource.update as any)).toHaveBeenCalled();
    });

    it('returns not_paused when no pause config exists', async () => {
      (prisma.$queryRawUnsafe as any).mockResolvedValue([]);

      const result = await unpausSourceIfExpired('source-1');

      expect(result.unpaused).toBe(false);
      expect(result.reason).toBe('not_paused');
    });
  });
});
