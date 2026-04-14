// =============================================================================
// Tests: lib/logger.ts
// Spies en console — no I/O real
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Spy at module level — never restored between tests (only cleared)
const logSpy   = vi.spyOn(console, 'log').mockImplementation(() => {});
const warnSpy  = vi.spyOn(console, 'warn').mockImplementation(() => {});
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

import { createLogger, logger } from '../logger';

beforeEach(() => {
  logSpy.mockClear();
  warnSpy.mockClear();
  errorSpy.mockClear();
});

afterAll(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('createLogger', () => {
  it('log.info escribe una línea con nivel INFO al console.log', () => {
    const log = createLogger('test-ctx');
    log.info('mensaje informativo');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('INFO');
    expect(output).toContain('[test-ctx]');
    expect(output).toContain('mensaje informativo');
  });

  it('log.debug escribe al console.log con nivel DEBUG', () => {
    const log = createLogger('debug-ctx');
    log.debug('mensaje debug');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('DEBUG');
    expect(output).toContain('mensaje debug');
  });

  it('log.warn escribe al console.warn con nivel WARN', () => {
    const log = createLogger('warn-ctx');
    log.warn('advertencia');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const output = warnSpy.mock.calls[0][0] as string;
    expect(output).toContain('WARN');
    expect(output).toContain('advertencia');
  });

  it('log.error escribe al console.error con nivel ERROR', () => {
    const log = createLogger('error-ctx');
    log.error('error crítico', { error: new Error('boom') });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain('ERROR');
    expect(output).toContain('error crítico');
  });

  it('incluye metadatos extras en la salida (excepto ctx y error)', () => {
    const log = createLogger('api');
    log.info('request completado', { action: 'save', result: 'success' });
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('action');
    expect(output).toContain('save');
  });

  it('no incluye "ctx" ni "error" como claves en los extras', () => {
    const log = createLogger('mod');
    log.error('fallo', { error: new Error('X'), action: 'upload' });
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).not.toContain('"ctx"');
    expect(output).not.toContain('"error"');
    expect(output).toContain('action');
  });

  it('no agrega JSON vacío al final cuando no hay extras', () => {
    const log = createLogger('clean');
    log.info('solo mensaje');
    const output = logSpy.mock.calls[0][0] as string;
    expect(output.trim()).not.toMatch(/\{\s*\}$/);
  });
});

describe('logger (instancia global)', () => {
  it('logger.info emite al console.log', () => {
    logger.info('global info');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('logger.warn emite al console.warn', () => {
    logger.warn('global warn');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('logger.error emite al console.error', () => {
    logger.error('global error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('logger.debug emite al console.log', () => {
    logger.debug('global debug');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
