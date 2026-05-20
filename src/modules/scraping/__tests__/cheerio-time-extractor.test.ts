/**
 * Tests para CheerioExtractor.extractTimeDates() y pickBestSchedule()
 *
 * Estos métodos son el corazón del fix de cobertura temporal Idartes:
 * en vez de enviar texto "21 de Mayo" (sin año) a Gemini, extraemos
 * el atributo `datetime="2026-05-21T20:00:00Z"` directamente del HTML.
 *
 * HTML fixture inspirado en el DOM real de idartes.gov.co:
 *   <time datetime="2026-05-21T20:00:00Z" class="datetime">21 de Mayo</time>
 */

import { describe, it, expect } from 'vitest';
import { CheerioExtractor } from '../extractors/cheerio.extractor';

// ─── Fixtures HTML ────────────────────────────────────────────────────────────

/** HTML real-ish de una página de evento Idartes */
const IDARTES_SINGLE_EVENT = `
<!DOCTYPE html>
<html lang="es">
<head><title>Concierto Sinfónico | Idartes</title></head>
<body>
  <nav><ul><li><a href="/">Inicio</a></li></ul></nav>
  <main class="node-evento">
    <h1>Concierto Sinfónico en el Teatro Mayor</h1>
    <div class="field-fecha">
      <time datetime="2026-05-21T20:00:00Z" class="datetime">21 de Mayo</time>
    </div>
    <div class="field-body">
      <p>Gran concierto sinfónico para toda la familia.</p>
    </div>
    <div class="field-lugar">Teatro Mayor Julio Mario Santo Domingo</div>
  </main>
  <footer>Footer institucional</footer>
</body>
</html>`;

/** HTML con múltiples fechas (rango de evento) */
const IDARTES_MULTI_DATE = `
<html><body>
  <main>
    <h1>Festival de Verano 2026</h1>
    <div class="fechas">
      <time datetime="2026-06-01T10:00:00Z">1 de Junio</time>
      <time datetime="2026-06-15T22:00:00Z">15 de Junio</time>
      <time datetime="2026-06-08T16:00:00Z">8 de Junio</time>
    </div>
  </main>
</body></html>`;

/** HTML con fechas pasadas (evento ya ocurrido) */
const HTML_PAST_DATES = `
<html><body>
  <time datetime="2025-03-10T18:00:00Z">10 de Marzo</time>
  <time datetime="2025-01-15T14:00:00Z">15 de Enero</time>
</body></html>`;

/** HTML sin tag time → Cheerio normal, sin extracción estructurada */
const HTML_PLAIN_TEXT_ONLY = `
<html><body>
  <p>El evento será el 21 de Mayo en el Teatro Mayor</p>
  <p>Entrada libre. Para todas las edades.</p>
</body></html>`;

/** HTML con <time> sin atributo datetime → ignorar */
const HTML_TIME_NO_DATETIME = `
<html><body>
  <p>Actividad cada <time>martes</time> y <time>jueves</time></p>
  <p>Duración: <time>2 horas</time></p>
</body></html>`;

/** HTML con datetime inválido → ignorar */
const HTML_INVALID_DATETIME = `
<html><body>
  <time datetime="not-a-date">Texto</time>
  <time datetime="20:00">Solo hora</time>
  <time datetime="">Vacío</time>
  <time datetime="2026-05-21T20:00:00Z">Válida</time>
</body></html>`;

/** HTML con datetime solo de hora (HH:MM) → ignorar (no tiene YYYY-MM-DD) */
const HTML_TIME_ONLY_VALUES = `
<html><body>
  <time datetime="20:00">8 PM</time>
  <time datetime="14:30">2:30 PM</time>
</body></html>`;

/** Fixture con timezone UTC explícita */
const HTML_UTC_TIMEZONE = `
<html><body>
  <time datetime="2026-07-04T23:59:59Z">4 de Julio</time>
</body></html>`;

/** Fixture mezcla pasado + futuro (referencia "now" injectable) */
const HTML_MIXED_PAST_FUTURE = `
<html><body>
  <time datetime="2025-12-31T00:00:00Z">31 de Diciembre 2025</time>
  <time datetime="2026-08-15T10:00:00Z">15 de Agosto 2026</time>
  <time datetime="2026-09-20T18:00:00Z">20 de Septiembre 2026</time>
</body></html>`;

// ─── extractTimeDates() ───────────────────────────────────────────────────────

describe('CheerioExtractor.extractTimeDates()', () => {

  it('caso 1: extrae una sola <time datetime> con fecha válida', () => {
    const result = CheerioExtractor.extractTimeDates(IDARTES_SINGLE_EVENT);

    expect(result).toHaveLength(1);
    expect(result[0].datetime).toBe('2026-05-21T20:00:00Z');
    expect(result[0].text).toBe('21 de Mayo');
  });

  it('caso 2: extrae múltiples <time datetime> y preserva todas', () => {
    const result = CheerioExtractor.extractTimeDates(IDARTES_MULTI_DATE);

    expect(result).toHaveLength(3);
    const datetimes = result.map(r => r.datetime);
    expect(datetimes).toContain('2026-06-01T10:00:00Z');
    expect(datetimes).toContain('2026-06-15T22:00:00Z');
    expect(datetimes).toContain('2026-06-08T16:00:00Z');
  });

  it('caso 3: preserva timezone UTC en el datetime (no normaliza)', () => {
    const result = CheerioExtractor.extractTimeDates(HTML_UTC_TIMEZONE);

    expect(result).toHaveLength(1);
    // El valor ISO original debe conservarse tal cual (con Z)
    expect(result[0].datetime).toBe('2026-07-04T23:59:59Z');
    expect(result[0].text).toBe('4 de Julio');
  });

  it('caso 4: texto "21 de Mayo" sin atributo datetime → array vacío', () => {
    const result = CheerioExtractor.extractTimeDates(HTML_PLAIN_TEXT_ONLY);

    expect(result).toHaveLength(0);
  });

  it('caso 5: <time> sin atributo datetime → ignorados', () => {
    const result = CheerioExtractor.extractTimeDates(HTML_TIME_NO_DATETIME);

    expect(result).toHaveLength(0);
  });

  it('caso 6: datetime inválido → ignorado, datetime válido → incluido', () => {
    const result = CheerioExtractor.extractTimeDates(HTML_INVALID_DATETIME);

    // "not-a-date", "20:00" y "" son inválidos o sin YYYY-MM-DD
    // Solo "2026-05-21T20:00:00Z" debe pasar
    expect(result).toHaveLength(1);
    expect(result[0].datetime).toBe('2026-05-21T20:00:00Z');
  });

  it('caso 7: datetime solo de hora "HH:MM" sin componente de fecha → ignorado', () => {
    const result = CheerioExtractor.extractTimeDates(HTML_TIME_ONLY_VALUES);

    expect(result).toHaveLength(0);
  });

  it('caso 8: HTML sin ningún <time> → array vacío', () => {
    const result = CheerioExtractor.extractTimeDates('<html><body><p>Sin fechas</p></body></html>');

    expect(result).toHaveLength(0);
  });

  it('caso 9: fechas pasadas son extraídas (pickBestSchedule decide luego)', () => {
    const result = CheerioExtractor.extractTimeDates(HTML_PAST_DATES);

    // extractTimeDates no filtra pasado/futuro — esa responsabilidad es de pickBestSchedule
    expect(result).toHaveLength(2);
  });

  it('caso 10: texto del <time> es limpiado (whitespace colapsado)', () => {
    const html = '<html><body><time datetime="2026-06-01T10:00:00Z">  1  de  Junio  </time></body></html>';
    const result = CheerioExtractor.extractTimeDates(html);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('1 de Junio');
  });

  it('caso 11: HTML roto/vacío → array vacío sin lanzar error', () => {
    expect(() => CheerioExtractor.extractTimeDates('')).not.toThrow();
    expect(CheerioExtractor.extractTimeDates('')).toHaveLength(0);

    expect(() => CheerioExtractor.extractTimeDates('<<<invalid html>>>')).not.toThrow();
  });

  it('caso 12: fecha solo con YYYY-MM-DD (sin hora) → válida', () => {
    const html = '<html><body><time datetime="2026-09-15">15 de Septiembre</time></body></html>';
    const result = CheerioExtractor.extractTimeDates(html);

    expect(result).toHaveLength(1);
    expect(result[0].datetime).toBe('2026-09-15');
  });
});

// ─── pickBestSchedule() ───────────────────────────────────────────────────────

describe('CheerioExtractor.pickBestSchedule()', () => {

  /** Referencia "now" fija para tests reproducibles */
  const NOW = new Date('2026-05-20T12:00:00Z');

  it('caso 1: única fecha futura → startDate correcto, sin endDate', () => {
    const timeDates = [{ datetime: '2026-05-21T20:00:00Z', text: '21 de Mayo' }];
    const result = CheerioExtractor.pickBestSchedule(timeDates, NOW);

    expect(result).not.toBeNull();
    expect(result!.startDate).toBe('2026-05-21');
    expect(result!.endDate).toBeUndefined();
  });

  it('caso 2: múltiples fechas futuras → earliest=startDate, latest=endDate', () => {
    const timeDates = CheerioExtractor.extractTimeDates(IDARTES_MULTI_DATE);
    // 2026-06-01, 2026-06-08, 2026-06-15 — todas futuras respecto a NOW (2026-05-20)
    const result = CheerioExtractor.pickBestSchedule(timeDates, NOW);

    expect(result).not.toBeNull();
    expect(result!.startDate).toBe('2026-06-01');
    expect(result!.endDate).toBe('2026-06-15');
  });

  it('caso 3: mix pasado + futuro → usa solo futuras, ignora pasadas', () => {
    const timeDates = CheerioExtractor.extractTimeDates(HTML_MIXED_PAST_FUTURE);
    // 2025-12-31 = pasada; 2026-08-15 y 2026-09-20 = futuras
    const result = CheerioExtractor.pickBestSchedule(timeDates, NOW);

    expect(result).not.toBeNull();
    expect(result!.startDate).toBe('2026-08-15');
    expect(result!.endDate).toBe('2026-09-20');
  });

  it('caso 4: todas las fechas son pasadas → retorna la más reciente (mejor que nada)', () => {
    const timeDates = CheerioExtractor.extractTimeDates(HTML_PAST_DATES);
    // 2025-01-15 y 2025-03-10 — ambas pasadas
    const result = CheerioExtractor.pickBestSchedule(timeDates, NOW);

    expect(result).not.toBeNull();
    // La más reciente es 2025-03-10
    expect(result!.startDate).toBe('2025-03-10');
    expect(result!.endDate).toBeUndefined();
  });

  it('caso 5: array vacío → null', () => {
    const result = CheerioExtractor.pickBestSchedule([], NOW);

    expect(result).toBeNull();
  });

  it('caso 6: solo una fecha futura → endDate undefined (no rango)', () => {
    const timeDates = [{ datetime: '2026-08-01T00:00:00Z' }];
    const result = CheerioExtractor.pickBestSchedule(timeDates, NOW);

    expect(result).not.toBeNull();
    expect(result!.startDate).toBe('2026-08-01');
    expect(result!.endDate).toBeUndefined();
  });

  it('caso 7: exactamente dos fechas futuras → startDate=primera, endDate=segunda', () => {
    const timeDates = [
      { datetime: '2026-07-01T10:00:00Z' },
      { datetime: '2026-07-31T22:00:00Z' },
    ];
    const result = CheerioExtractor.pickBestSchedule(timeDates, NOW);

    expect(result).not.toBeNull();
    expect(result!.startDate).toBe('2026-07-01');
    expect(result!.endDate).toBe('2026-07-31');
  });

  it('caso 8: usa NOW por defecto (sin parámetro) → no lanza error', () => {
    const timeDates = [{ datetime: '2099-01-01T00:00:00Z' }];
    // Sin parámetro now → usa new Date() real
    expect(() => CheerioExtractor.pickBestSchedule(timeDates)).not.toThrow();
    const result = CheerioExtractor.pickBestSchedule(timeDates);
    expect(result).not.toBeNull();
    expect(result!.startDate).toBe('2099-01-01');
  });

  it('caso 9: datetime inválido en array → ignorado graciosamente', () => {
    const timeDates = [
      { datetime: 'not-a-date' },
      { datetime: '2026-06-10T10:00:00Z' },
    ];
    const result = CheerioExtractor.pickBestSchedule(timeDates, NOW);

    expect(result).not.toBeNull();
    expect(result!.startDate).toBe('2026-06-10');
  });

  it('caso 10: integración end-to-end — extractTimeDates + pickBestSchedule con HTML Idartes', () => {
    const timeDates = CheerioExtractor.extractTimeDates(IDARTES_SINGLE_EVENT);
    const schedule  = CheerioExtractor.pickBestSchedule(timeDates, NOW);

    // HTML Idartes tiene una fecha futura: 2026-05-21
    expect(schedule).not.toBeNull();
    expect(schedule!.startDate).toBe('2026-05-21');
    expect(schedule!.endDate).toBeUndefined();
  });

  it('caso 11: tres fechas futuras con una pasada intercalada → endDate es la última futura', () => {
    const timeDates = [
      { datetime: '2024-12-01T00:00:00Z' }, // pasada
      { datetime: '2026-06-01T00:00:00Z' }, // futura 1
      { datetime: '2026-06-10T00:00:00Z' }, // futura 2
      { datetime: '2026-06-20T00:00:00Z' }, // futura 3
    ];
    const result = CheerioExtractor.pickBestSchedule(timeDates, NOW);

    expect(result!.startDate).toBe('2026-06-01');
    expect(result!.endDate).toBe('2026-06-20');
  });
});

// ─── textFromHtml() (regresión — verifica que sigue funcionando) ──────────────

describe('CheerioExtractor.textFromHtml() — regresión', () => {
  it('extrae texto limpio eliminando scripts y nav', () => {
    const html = `<html><body>
      <nav>Menú</nav>
      <script>alert(1)</script>
      <main>Contenido del evento</main>
    </body></html>`;
    const text = CheerioExtractor.textFromHtml(html);

    expect(text).toContain('Contenido del evento');
    expect(text).not.toContain('Menú');
    expect(text).not.toContain('alert');
  });

  it('devuelve cadena vacía para HTML inválido', () => {
    // No lanza error — devuelve ''
    expect(CheerioExtractor.textFromHtml('')).toBe('');
  });

  it('NOTA — <time datetime> pierde su atributo (causa raíz del bug Idartes)', () => {
    // textFromHtml() usa .text() de cheerio: convierte <time datetime="2026-05-21T...">21 de Mayo</time>
    // en solo "21 de Mayo". Gemini recibe texto incompleto sin año/timezone.
    // Este test documenta el comportamiento existente (no es un bug que queremos "arreglar" aquí).
    const html = `<html><body>
      <time datetime="2026-05-21T20:00:00Z">21 de Mayo</time>
    </body></html>`;
    const text = CheerioExtractor.textFromHtml(html);

    // El texto resultante NO contiene la fecha ISO — solo el texto visible
    expect(text).toContain('21 de Mayo');
    expect(text).not.toContain('2026-05-21');
    expect(text).not.toContain('T20:00:00Z');
  });
});
