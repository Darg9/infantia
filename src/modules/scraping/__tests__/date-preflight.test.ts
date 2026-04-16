import { describe, it, expect } from 'vitest';
import { isPastEventContent, extractDatesFromText } from '../utils/date-preflight';

// Fecha de referencia fija para todos los tests
const REF = new Date('2026-04-15T12:00:00Z');

// Helper para construir texto con una fecha relativa
const textWith = (dateStr: string) => `Evento el ${dateStr} en el Teatro Principal.`;

describe('extractDatesFromText', () => {
  it('detecta formato ES: "15 de abril de 2025"', () => {
    const dates = extractDatesFromText('Evento el 15 de abril de 2025 en Bogotá.');
    expect(dates).toHaveLength(1);
    expect(dates[0].getFullYear()).toBe(2025);
    expect(dates[0].getMonth()).toBe(3); // abril = índice 3
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
    const dates = extractDatesFromText(
      'Del 1 de enero de 2025 al 15 de marzo de 2025.',
    );
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

describe('isPastEventContent', () => {
  it('retorna false si no hay fechas (incertidumbre → procesar)', () => {
    expect(isPastEventContent('Taller de arte para niños.', REF)).toBe(false);
  });

  it('retorna false si hay alguna fecha futura', () => {
    // Fecha futura: 20 de junio de 2026
    const text = 'Evento el 20 de junio de 2026 en Corferias.';
    expect(isPastEventContent(text, REF)).toBe(false);
  });

  it('retorna false si hay fechas pasadas recientes (< 14 días)', () => {
    // 5 de abril de 2026 = 10 días antes de REF → dentro del buffer
    const text = 'Evento el 5 de abril de 2026 en la Media Torta.';
    expect(isPastEventContent(text, REF)).toBe(false);
  });

  it('retorna true si todas las fechas son claramente pasadas (> 14 días)', () => {
    // 1 de marzo de 2026 = ~45 días antes de REF
    const text = 'El evento fue el 1 de marzo de 2026. Entrada libre.';
    expect(isPastEventContent(text, REF)).toBe(true);
  });

  it('retorna true para fechas del año anterior', () => {
    const text = 'Concierto el 15 de octubre de 2025 en el Colón.';
    expect(isPastEventContent(text, REF)).toBe(true);
  });

  it('retorna false si una fecha es pasada y otra es futura (mix)', () => {
    const text =
      'Temporada 2025-12-01 al 2026-06-30. Entrada libre.';
    expect(isPastEventContent(text, REF)).toBe(false);
  });

  it('retorna false si las fechas pasadas están dentro del buffer de 14 días', () => {
    // 3 de abril de 2026 = 12 días antes de REF → dentro del buffer
    const text = 'Evento el 2026-04-03 en el Planetario.';
    expect(isPastEventContent(text, REF)).toBe(false);
  });

  it('retorna true para texto con ISO format claramente pasado', () => {
    const text = 'Fecha del evento: 2025-01-10. Lugar: Biblioteca.';
    expect(isPastEventContent(text, REF)).toBe(true);
  });

  it('retorna true para texto con DD/MM/YYYY claramente pasado', () => {
    const text = 'Actividad: 10/01/2025. Entrada libre.';
    expect(isPastEventContent(text, REF)).toBe(true);
  });

  it('es conservador: texto sin fechas siempre pasa al NLP', () => {
    const texts = [
      'Actividad para niños y familias.',
      'Taller de pintura todos los sábados.',
      'Exposición permanente en el museo.',
    ];
    texts.forEach((t) => expect(isPastEventContent(t, REF)).toBe(false));
  });
});
