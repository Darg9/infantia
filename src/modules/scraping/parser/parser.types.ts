// =============================================================================
// parser.types.ts — Tipos compartidos del módulo de parser resiliente
//
// Wrapper ParseResult: añade la fuente ('gemini' | 'fallback') sin modificar
// ActivityNLPResult (el schema Zod es inmutable).
// =============================================================================

import type { ActivityNLPResult } from '../types';

// ── ParseResult ───────────────────────────────────────────────────────────────

/** Resultado del parser con información de qué fuente lo produjo. */
export interface ParseResult {
  result: ActivityNLPResult;
  source: 'gemini' | 'fallback';
}

// ── Error helpers ─────────────────────────────────────────────────────────────

/**
 * Determina si un error es recuperable con fallback.
 * Solo 429 (quota), 503 (overload) y timeout son retryable para Gemini.
 */
export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('quota') ||
    msg.includes('timeout') ||
    msg.includes('timed out')
  );
}

// ── Session metrics ───────────────────────────────────────────────────────────

export interface ParserMetrics {
  geminiOk:      number;  // Fase 3: Gemini respondió OK
  fallbackUsed:  number;  // Fase 3: se usó fallback Cheerio
  geminiErrors:  number;  // Fase 3: errores no-retryable (thrown)
  discoverOk:    number;  // Fase 2: Gemini OK
  discoverFallback: number; // Fase 2: pasaron todos los URLs (fallback)
}

let _metrics: ParserMetrics = {
  geminiOk:         0,
  fallbackUsed:     0,
  geminiErrors:     0,
  discoverOk:       0,
  discoverFallback: 0,
};

export function getParserMetrics(): Readonly<ParserMetrics> {
  return { ..._metrics };
}

export function resetParserMetrics(): void {
  _metrics = { geminiOk: 0, fallbackUsed: 0, geminiErrors: 0, discoverOk: 0, discoverFallback: 0 };
}

/** @internal — solo para tests */
export function _incrementMetric(key: keyof ParserMetrics): void {
  _metrics[key]++;
}
