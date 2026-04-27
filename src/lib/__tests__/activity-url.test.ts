import { describe, it, expect } from 'vitest';
import { slugifyTitle, activityPath, extractActivityId } from '../activity-url';

describe('slugifyTitle', () => {
  it('convierte a minúsculas y reemplaza espacios', () => {
    expect(slugifyTitle('Taller de Pintura')).toBe('taller-de-pintura');
  });

  it('elimina tildes y diacríticos', () => {
    expect(slugifyTitle('Actividades para Niños')).toBe('actividades-para-ninos');
    expect(slugifyTitle('Taller de música')).toBe('taller-de-musica');
    expect(slugifyTitle('Ñoño')).toBe('nono');
  });

  it('elimina caracteres especiales y colapsa guiones', () => {
    // '&' se elimina, los espacios adyacentes quedan → colapso → un guion
    expect(slugifyTitle('Arte & Creatividad!')).toBe('arte-creatividad');
    expect(slugifyTitle('¿Qué hay para hacer?')).toBe('que-hay-para-hacer');
  });

  it('colapsa múltiples espacios y guiones', () => {
    // '&' se elimina, los dos espacios dobles quedan → colapso a un guion
    expect(slugifyTitle('Arte  &  Música')).toBe('arte-musica');
  });

  it('trunca a 60 caracteres', () => {
    const long = 'a'.repeat(80);
    expect(slugifyTitle(long).length).toBeLessThanOrEqual(60);
  });

  it('maneja string vacío', () => {
    expect(slugifyTitle('')).toBe('');
  });
});

describe('activityPath', () => {
  it('genera ruta con UUID y slug', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(activityPath(id, 'Taller de Arte')).toBe(
      '/actividad/550e8400-e29b-41d4-a716-446655440000-taller-de-arte',
    );
  });

  it('genera ruta solo con UUID si title vacío', () => {
    const id = 'abc-123';
    expect(activityPath(id, '')).toBe('/actividad/abc-123');
  });
});

describe('extractActivityId', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';

  it('extrae UUID de param bare', () => {
    expect(extractActivityId(uuid)).toBe(uuid);
  });

  it('extrae UUID de param con slug', () => {
    expect(extractActivityId(`${uuid}-taller-de-arte`)).toBe(uuid);
  });

  it('retorna el param completo si no es UUID', () => {
    expect(extractActivityId('not-a-uuid')).toBe('not-a-uuid');
  });

  it('es case-insensitive', () => {
    const upper = uuid.toUpperCase();
    expect(extractActivityId(upper)).toBe(upper);
  });
});
