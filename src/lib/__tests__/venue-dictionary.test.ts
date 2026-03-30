import { describe, it, expect } from 'vitest';
import { lookupVenue, normalizeVenue } from '../venue-dictionary';

describe('normalizeVenue', () => {
  it('convierte a minúsculas', () => {
    expect(normalizeVenue('PLANETARIO')).toBe('planetario');
  });

  it('elimina tildes', () => {
    expect(normalizeVenue('Jardín Botánico')).toBe('jardin botanico');
  });

  it('elimina puntuación y colapsa espacios', () => {
    expect(normalizeVenue('Sala múltiple, Planetario de Bogotá')).toBe('sala multiple planetario de bogota');
  });

  it('colapsa espacios múltiples y trim', () => {
    expect(normalizeVenue('  Virgilio   Barco  ')).toBe('virgilio barco');
  });
});

describe('lookupVenue', () => {
  it('retorna null para string vacío', () => {
    expect(lookupVenue('')).toBeNull();
  });

  it('retorna null para venue desconocido', () => {
    expect(lookupVenue('Casa de Juan en ninguna parte')).toBeNull();
  });

  // ── Planetario ────────────────────────────────────────────────────────────
  it('encuentra el Planetario con nombre simple', () => {
    const r = lookupVenue('Planetario de Bogotá');
    expect(r).not.toBeNull();
    expect(r!.name).toBe('Planetario de Bogotá');
    expect(r!.lat).toBeCloseTo(4.6534, 2);
    expect(r!.lng).toBeCloseTo(-74.0836, 2);
  });

  it('encuentra el Planetario con nombre de sala específica', () => {
    const r = lookupVenue('Sala múltiple, Planetario de Bogotá');
    expect(r!.name).toBe('Planetario de Bogotá');
  });

  it('encuentra el Planetario con "Domo del Planetario"', () => {
    expect(lookupVenue('Domo del Planetario de Bogotá')).not.toBeNull();
  });

  it('encuentra el Planetario con "Planetario de Bogotá, Auditorio"', () => {
    expect(lookupVenue('Planetario de Bogotá, Auditorio')).not.toBeNull();
  });

  // ── BibloRed ──────────────────────────────────────────────────────────────
  it('encuentra Virgilio Barco', () => {
    const r = lookupVenue('Biblioteca Virgilio Barco');
    expect(r!.name).toBe('Biblioteca Virgilio Barco');
    expect(r!.lat).toBeCloseTo(4.6584, 2);
  });

  it('encuentra El Tintal', () => {
    const r = lookupVenue('Biblioteca Pública El Tintal Manuel Zapata Olivella');
    expect(r!.name).toContain('Tintal');
  });

  it('encuentra BibloRed Chapinero', () => {
    const r = lookupVenue('BibloRed Chapinero — sala infantil');
    expect(r!.name).toContain('Chapinero');
  });

  it('encuentra BibloRed Suba', () => {
    expect(lookupVenue('BibloRed Suba')).not.toBeNull();
  });

  // ── Centros de Felicidad ──────────────────────────────────────────────────
  it('encuentra Centro de Felicidad Chapinero', () => {
    const r = lookupVenue('Centro de Felicidad Chapinero');
    expect(r!.name).toContain('Chapinero');
    expect(r!.lat).toBeCloseTo(4.6398, 2);
  });

  it('encuentra Centro de Felicidad Bosa', () => {
    expect(lookupVenue('Centro Felicidad Bosa')).not.toBeNull();
  });

  it('encuentra Centro de Felicidad Kennedy', () => {
    expect(lookupVenue('Centro de Felicidad Kennedy — sala de talleres')).not.toBeNull();
  });

  // ── Otros venues ──────────────────────────────────────────────────────────
  it('encuentra Jardín Botánico', () => {
    const r = lookupVenue('Jardín Botánico José Celestino Mutis');
    expect(r!.name).toContain('Bot');
    expect(r!.lat).toBeCloseTo(4.6588, 2);
  });

  it('encuentra Maloka', () => {
    const r = lookupVenue('Maloka — Centro Interactivo de Ciencia y Tecnología');
    expect(r!.name).toBe('Maloka');
  });

  it('encuentra Parque Simón Bolívar', () => {
    expect(lookupVenue('Parque Simón Bolívar, Bogotá')).not.toBeNull();
  });

  it('encuentra Cinemateca de Bogotá', () => {
    expect(lookupVenue('Cinemateca Distrital de Bogotá')).not.toBeNull();
  });

  it('encuentra Museo de los Niños', () => {
    expect(lookupVenue('Museo de los Niños de Bogotá')).not.toBeNull();
  });

  // ── Matching es case-insensitive y sin tildes ─────────────────────────────
  it('funciona con mayúsculas', () => {
    expect(lookupVenue('PLANETARIO DE BOGOTÁ')).not.toBeNull();
  });

  it('funciona sin tildes en el input', () => {
    expect(lookupVenue('Jardin Botanico de Bogota')).not.toBeNull();
  });

  it('NO confunde Av. Simón Bolívar con el Parque (falta "parque")', () => {
    expect(lookupVenue('Av. Simón Bolívar #5')).toBeNull();
  });

  it('SÍ encuentra Parque Simón Bolívar con las 3 keywords', () => {
    expect(lookupVenue('Parque Simón Bolívar, Bogotá')).not.toBeNull();
  });
});
