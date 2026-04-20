import { ActivityClusterNode, computeHybridScore, clusterizeNodes } from '../cluster';
import { describe, it, expect } from 'vitest';

describe('Deduplication Engine', () => {

    describe('computeHybridScore', () => {
        it('rejects clearly different titles', () => {
            const a: ActivityClusterNode = { id: '1', title: 'Taller de Guitarra', startDate: new Date('2026-05-01T10:00:00Z'), locationId: 'loc1', providerId: 'p1', sourceDomain: null, sourceConfidence: 0.9 };
            const b: ActivityClusterNode = { id: '2', title: 'Curso de Cocina', startDate: new Date('2026-05-01T10:00:00Z'), locationId: 'loc1', providerId: 'p2', sourceDomain: null, sourceConfidence: 0.8 };
            const result = computeHybridScore(a, b);
            expect(result.rejected).toBe(true);
            expect(result.reason).toBe('title_mismatch_too_high');
        });

        it('does not merge recurring weekly events (guards recurrence)', () => {
            const a: ActivityClusterNode = { id: '1', title: 'Taller infantil', startDate: new Date('2026-05-01T10:00:00Z'), locationId: 'loc1', providerId: 'p1', sourceDomain: null, sourceConfidence: 0.9 };
            // Exact same event, exactly 7 days apart (recurring weekly event)
            const b: ActivityClusterNode = { id: '2', title: 'Taller infantil', startDate: new Date('2026-05-08T10:00:00Z'), locationId: 'loc1', providerId: 'p2', sourceDomain: null, sourceConfidence: 0.8 };
            
            const result = computeHybridScore(a, b);
            expect(result.rejected).toBe(true);
            expect(result.reason).toBe('date_diff_too_large');
        });

        it('clusters exact same events', () => {
            const a: ActivityClusterNode = { id: '1', title: 'Taller de pintura', startDate: new Date('2026-05-01T10:00:00Z'), locationId: 'loc1', providerId: 'p1', sourceDomain: null, sourceConfidence: 0.9 };
            const b: ActivityClusterNode = { id: '2', title: 'Taller de pintura (niños)', startDate: new Date('2026-05-01T11:00:00Z'), locationId: 'loc1', providerId: 'p2', sourceDomain: null, sourceConfidence: 0.8 };
            
            const result = computeHybridScore(a, b);
            expect(result.rejected).toBe(false);
            expect(result.score).toBeGreaterThanOrEqual(0.7);
        });
    });

    describe('clusterizeNodes', () => {
        it('groups nodes properly', () => {
            const n1: ActivityClusterNode = { id: '1', title: 'Club de lectura', startDate: new Date('2026-05-01T10:00:00Z'), locationId: 'loc1', providerId: 'p1', sourceDomain: null, sourceConfidence: 0.9 };
            const n2: ActivityClusterNode = { id: '2', title: 'Club de lectura para niños', startDate: new Date('2026-05-01T10:00:00Z'), locationId: 'loc1', providerId: 'p2', sourceDomain: null, sourceConfidence: 0.9 };
            const n3: ActivityClusterNode = { id: '3', title: 'Teatro', startDate: new Date('2026-05-02T10:00:00Z'), locationId: 'loc2', providerId: 'p3', sourceDomain: null, sourceConfidence: 0.9 };
            
            const clusters = clusterizeNodes([n1, n2, n3]);
            expect(clusters.length).toBe(1); // Should find only 1 cluster, containing n1 and n2
            expect(clusters[0].canonical.id).toBe('1');
            expect(clusters[0].matches.length).toBe(1);
            expect(clusters[0].matches[0].id).toBe('2');
        });
    });
});
