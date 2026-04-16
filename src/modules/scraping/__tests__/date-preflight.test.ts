import { describe, it, expect, beforeEach } from 'vitest';
import {
  isPastEventContent,
  evaluatePreflight,
  extractDatesFromText,
  extractDatetimeAttributes,
  getPreflightStats,
  resetPreflightStats,
} from '../utils/date-preflight';

// Fecha de referencia fija para todos los tests
const REF = new Date('2026-04-15T12:00:00Z');

describe('extractDatesFromText', () => {
  it('detecta formato ES: "15 de abril de 2025"', () => {
    const dates = extractDatesFromText('Evento el 15 de abril de 2025 en Bogotá.');
    expect(dates).toHaveLength(1);
    expect(dates[0].getFullYear()).toBe(2025);
    expect(dates[0].getMonth()).toBe(3);
    expect(dates[0].getDate()).toBe(15);
  });

  it('detecta formato ES sin "de": "15 de abril 2025"', () => {
    const dates = extractDatesFromText('Fecha: 15 de abril 2025.');
    expect(dates).toHaveLength(1);
    expect(dates[0].getFullYear()).toBe(2025);
  });

  it('detecta formato ISO: "2025-04-15"', () => {
    const dates = extractDatesFromText('startDate: 2025-04-15.');
    expect(dates).toHaveLength(1);
    expect(dates[0].getFullYear()).toBe(2025);
    expect(dates[0].getMonth()).toBe(3);
  });

  it('detecta formato DD/MM/YYYY: "15/04/2025"', () => {
    const dates = extractDatesFromText('Fecha: 15/04/2025.');
    expect(dates).toHaveLength(1);
    expect(dates[0].getFullYear()).toBe(2025);
  });

  it('detecta múltiples fechas en el mismo texto', () => {
    const dates = extractDatesFromText('Del 1 de enero de 2025 al 15 de marzo de 2025.');
    expect(dates).toHaveLength(2);
  });

  it('ignora años fuera de rango (< 2020 o > 2035)', () => {
    const dates = extractDatesFromText('Evento en 2015-03-10 y 2040-05-01.');
    expect(dates).toHaveLength(0);
  });

  it('retorna array vacío si no hay fechas', () => {
    expect(extractDatesFromText('No hay ninguna fecha aquí.')).toHaveLength(0);
  });
});

describe('extractDatetimeAttributes', () => {
  it('extrae datetime="YYYY-MM-DD" de atributo HTML', () => {
    const html = '<time datetime="2025-03-15">15 de marzo de 2025</time>';
    const dates = extractDatetimeAttributes(html);
    expect(dates).toHaveLength(1);
    expect(dates[0].getFullYear()).toBe(2025);
    expect(dates[0].getMonth()).toBe(2); // marzo = índice 2
    expect(dates[0].getDate()).toBe(15);
  });

  it('extrae datetime con hora: "2025-03-15T10:00:00"', () => {
    const html = '<time datetime="2025-03-15T10:00:00">15 de marzo</time>';
    const dates = extractDatetimeAttributes(html);
    expect(dates).toHaveLength(1);
    expect(dates[0].getFullYear()).toBe(2025);
  });

  it('extrae múltiples atributos datetime', () => {
    const html = `
      <time datetime="2025-04-01">Inicio</time>
      <time datetime="2025-04-30">Fin</time>
    `;
    const dates = extractDatetimeAttributes(html);
    expect(dates).toHaveLength(2);
  });

  it('retorna vacío si no hay atributos datetime', () => {
    const html = '<p>Evento el 15 de abril de 2025</p>';
    expect(extractDatetimeAttributes(html)).toHaveLength(0);
  });

  it('ignora datetime con años fuera de rango', () => {
    const html = '<time datetime="2015-03-10">viejo</time>';
    expect(extractDatetimeAttributes(html)).toHaveLength(0);
  });
});

describe('isPastEventContent — Capa 1: datetime HTML', () => {
  it('retorna true si datetime es claramente pasado (> 14d)', () => {
    const html = '<time datetime="2025-01-10">10 de enero</time>';
    expect(isPastEventContent(html, REF)).toBe(true);
  });

  it('retorna false si datetime es futuro', () => {
    const html = '<time datetime="2026-06-20">20 de junio</time>';
    expect(isPastEventContent(html, REF)).toBe(false);
  });

  it('retorna false si datetime está dentro del buffer de 14 días', () => {
    // 5 de abril de 2026 = 10 días antes de REF
    const html = '<time datetime="2026-04-05">5 de abril</time>';
    expect(isPastEventContent(html, REF)).toBe(false);
  });

  it('retorna false si algún datetime es futuro (mix pasado/futuro)', () => {
    const html = `
      <time datetime="2025-10-01">inicio</time>
      <time datetime="2026-06-30">fin</time>
    `;
    expect(isPastEventContent(html, REF)).toBe(false);
  });

  it('caso BibloRed real: evento pasado detectado via datetime', () => {
    const html = `
      <article>
        <h1>Taller de escritura creativa</h1>
        <time datetime="2025-03-22">22 de marzo de 2025</time>
        <p>Descripción del taller para adultos.</p>
      </article>
    `;
    expect(isPastEventContent(html, REF)).toBe(true);
  });

  it('caso BibloRed real: evento futuro no se descarta', () => {
    const html = `
      <article>
        <h1>Club de lectura infantil</h1>
        <time datetime="2026-05-10">10 de mayo de 2026</time>
        <p>Todos los sábados en la biblioteca.</p>
      </article>
    `;
    expect(isPastEventContent(html, REF)).toBe(false);
  });
});

describe('isPastEventContent — Capa 2: texto plano', () => {
  it('retorna false si no hay fechas (incertidumbre → procesar)', () => {
    expect(isPastEventContent('Taller de arte para niños.', REF)).toBe(false);
  });

  it('retorna false si hay alguna fecha futura en texto', () => {
    const text = 'Evento el 20 de junio de 2026 en Corferias.';
    expect(isPastEventContent(text, REF)).toBe(false);
  });

  it('retorna false si fechas pasadas recientes (< 14 días)', () => {
    const text = 'Evento el 5 de abril de 2026 en la Media Torta.';
    expect(isPastEventContent(text, REF)).toBe(false);
  });

  it('retorna true si todas las fechas de texto son claramente pasadas', () => {
    const text = 'El evento fue el 1 de marzo de 2026. Entrada libre.';
    expect(isPastEventContent(text, REF)).toBe(true);
  });

  it('retorna true para fechas del año anterior en texto', () => {
    const text = 'Concierto el 15 de octubre de 2025 en el Colón.';
    expect(isPastEventContent(text, REF)).toBe(true);
  });

  it('retorna false si mix de fechas pasada/futura en texto', () => {
    const text = 'Temporada 2025-12-01 al 2026-06-30. Entrada libre.';
    expect(isPastEventContent(text, REF)).toBe(false);
  });

  it('retorna true para ISO claramente pasado en texto', () => {
    const text = 'Fecha del evento: 2025-01-10. Lugar: Biblioteca.';
    expect(isPastEventContent(text, REF)).toBe(true);
  });

  it('retorna true para DD/MM/YYYY claramente pasado en texto', () => {
    const text = 'Actividad: 10/01/2025. Entrada libre.';
    expect(isPastEventContent(text, REF)).toBe(true);
  });
});

describe('isPastEventContent — Capa 3: keywords y años pasados', () => {
  it('retorna true si el HTML solo menciona años pasados (sin año actual)', () => {
    const html = '<p>Actividades realizadas en 2024. Programación cerrada.</p>';
    expect(isPastEventContent(html, REF)).toBe(true);
  });

  it('retorna false si el HTML menciona año actual junto con año pasado', () => {
    const html = '<p>Retrospectiva 2024–2026. Más eventos en 2026.</p>';
    expect(isPastEventContent(html, REF)).toBe(false);
  });

  it('keyword "finalizado" descarta si no hay año actual', () => {
    const html = '<p>Este evento ha finalizado. Gracias por participar.</p>';
    expect(isPastEventContent(html, REF)).toBe(true);
  });

  it('keyword "finalizado" NO descarta si hay año actual presente', () => {
    // El año 2026 aparece → podría haber más ediciones
    const html = '<p>Edición 2026 finalizada. Próxima edición en julio 2026.</p>';
    expect(isPastEventContent(html, REF)).toBe(false);
  });

  it('es conservador: texto sin señales siempre pasa al NLP', () => {
    const texts = [
      'Actividad para niños y familias.',
      'Taller de pintura todos los sábados.',
      'Exposición permanente en el museo.',
    ];
    texts.forEach((t) => expect(isPastEventContent(t, REF)).toBe(false));
  });
});

describe('evaluatePreflight — resultado enriquecido', () => {
  it('devuelve reason=datetime_past para atributo datetime pasado', () => {
    const html = '<time datetime="2025-01-10">10 de enero</time>';
    const result = evaluatePreflight(html, REF);
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('datetime_past');
    expect(result.datesFound).toBe(1);
  });

  it('devuelve reason=text_date_past para fecha en texto plano pasada', () => {
    const html = '<p>Evento el 1 de marzo de 2026.</p>';
    const result = evaluatePreflight(html, REF);
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('text_date_past');
    expect(result.datesFound).toBe(1);
  });

  it('devuelve reason=past_year_only para solo años pasados', () => {
    const html = '<p>Actividades realizadas en 2024.</p>';
    const result = evaluatePreflight(html, REF);
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('past_year_only');
    expect(result.datesFound).toBe(0);
  });

  it('devuelve reason=keyword_past para keyword sin año actual', () => {
    const html = '<p>Este evento ha finalizado.</p>';
    const result = evaluatePreflight(html, REF);
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('keyword_past');
  });

  it('devuelve reason=process y skip=false para evento futuro', () => {
    const html = '<time datetime="2026-06-20">20 de junio</time>';
    const result = evaluatePreflight(html, REF);
    expect(result.skip).toBe(false);
    expect(result.reason).toBe('process');
  });

  it('devuelve reason=process y skip=false sin señales', () => {
    const result = evaluatePreflight('Taller de arte para niños.', REF);
    expect(result.skip).toBe(false);
    expect(result.reason).toBe('process');
    expect(result.datesFound).toBe(0);
  });
});

describe('getPreflightStats / resetPreflightStats — contadores', () => {
  beforeEach(() => resetPreflightStats());

  it('inicia en cero tras reset', () => {
    const s = getPreflightStats();
    expect(s.total).toBe(0);
    expect(s.sent_to_gemini).toBe(0);
    expect(s.skipped_datetime).toBe(0);
  });

  it('acumula sent_to_gemini correctamente', () => {
    evaluatePreflight('Taller de arte.', REF);
    evaluatePreflight('Exposición permanente.', REF);
    const s = getPreflightStats();
    expect(s.total).toBe(2);
    expect(s.sent_to_gemini).toBe(2);
    expect(s.skipped_datetime).toBe(0);
  });

  it('acumula skipped_datetime correctamente', () => {
    evaluatePreflight('<time datetime="2025-01-10">ene</time>', REF);
    evaluatePreflight('<time datetime="2025-02-01">feb</time>', REF);
    const s = getPreflightStats();
    expect(s.skipped_datetime).toBe(2);
    expect(s.sent_to_gemini).toBe(0);
    expect(s.total).toBe(2);
  });

  it('acumula razones mixtas correctamente', () => {
    evaluatePreflight('<time datetime="2025-01-10">ene</time>', REF); // datetime
    evaluatePreflight('El evento fue el 1 de marzo de 2026.', REF);   // text_date
    evaluatePreflight('Taller de arte para niños.', REF);              // process
    const s = getPreflightStats();
    expect(s.total).toBe(3);
    expect(s.skipped_datetime).toBe(1);
    expect(s.skipped_text_date).toBe(1);
    expect(s.sent_to_gemini).toBe(1);
  });
});
