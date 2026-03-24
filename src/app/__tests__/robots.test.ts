import { describe, it, expect } from 'vitest';
import robots from '../robots';

// Tests for robots.txt generation
describe('robots()', () => {
  it('retorna un objeto con rules', () => {
    const result = robots();
    expect(result).toHaveProperty('rules');
    expect(Array.isArray(result.rules) || typeof result.rules === 'object').toBe(true);
  });

  it('apunta a un sitemap.xml válido', () => {
    const result = robots();
    expect(result.sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
  });

  it('permite crawling en /', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules[0];
    const allow = Array.isArray(mainRule.allow) ? mainRule.allow : [mainRule.allow];
    expect(allow).toContain('/');
  });

  it('bloquea /admin/', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules[0];
    const disallow = Array.isArray(mainRule.disallow) ? mainRule.disallow : [mainRule.disallow];
    expect(disallow).toContain('/admin/');
  });

  it('bloquea /api/', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules[0];
    const disallow = Array.isArray(mainRule.disallow) ? mainRule.disallow : [mainRule.disallow];
    expect(disallow).toContain('/api/');
  });

  it('bloquea /perfil/', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules[0];
    const disallow = Array.isArray(mainRule.disallow) ? mainRule.disallow : [mainRule.disallow];
    expect(disallow).toContain('/perfil/');
  });

  it('bloquea /login', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules[0];
    const disallow = Array.isArray(mainRule.disallow) ? mainRule.disallow : [mainRule.disallow];
    expect(disallow).toContain('/login');
  });

  it('aplica a User-agent: *', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules[0];
    expect(mainRule.userAgent).toBe('*');
  });
});
