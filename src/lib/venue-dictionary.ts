// =============================================================================
// venue-dictionary.ts
// Diccionario curado de venues conocidos en Bogotá con coordenadas exactas.
// Consultado ANTES de llamar a Nominatim para evitar API calls innecesarios
// y garantizar coords precisas en venues de alta recurrencia.
//
// Formato de cada entrada:
//   keywords: palabras clave que deben aparecer en el nombre/dirección del venue
//   lat/lng:  coordenadas del centro del edificio (Google Maps verificadas)
//   name:     nombre canónico
// =============================================================================

export interface VenueEntry {
  keywords: string[];   // todas deben estar presentes (AND)
  lat: number;
  lng: number;
  name: string;         // nombre canónico para logs
}

// Normaliza un string para matching: minúsculas, sin tildes, sin caracteres especiales
export function normalizeVenue(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')   // quitar puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

// Un venue coincide si TODAS sus keywords están en el texto normalizado del venue
function matches(text: string, entry: VenueEntry): boolean {
  const n = normalizeVenue(text);
  return entry.keywords.every((kw) => n.includes(kw));
}

/**
 * Busca el venue en el diccionario.
 * @param venueName   Nombre o dirección extraída del scraping
 * @returns Coordenadas exactas del venue, o null si no hay coincidencia
 */
export function lookupVenue(venueName: string): Pick<VenueEntry, 'lat' | 'lng' | 'name'> | null {
  if (!venueName?.trim()) return null;
  for (const entry of VENUE_DICTIONARY) {
    if (matches(venueName, entry)) {
      return { lat: entry.lat, lng: entry.lng, name: entry.name };
    }
  }
  return null;
}

// =============================================================================
// DICCIONARIO — Bogotá, Colombia
// Coords verificadas en OpenStreetMap / Google Maps (marzo 2026)
// =============================================================================
const VENUE_DICTIONARY: VenueEntry[] = [

  // ── BibloRed ──────────────────────────────────────────────────────────────
  {
    keywords: ['virgilio', 'barco'],
    lat: 4.6584, lng: -74.0954,
    name: 'Biblioteca Virgilio Barco',
  },
  {
    keywords: ['tintal'],
    lat: 4.6222, lng: -74.1442,
    name: 'Biblioteca El Tintal Manuel Zapata Olivella',
  },
  {
    keywords: ['tunal'],
    lat: 4.5694, lng: -74.1140,
    name: 'Biblioteca El Tunal Julio Mario Santo Domingo',
  },
  {
    keywords: ['luis', 'angel', 'arango'],
    lat: 4.5968, lng: -74.0740,
    name: 'Biblioteca Luis Ángel Arango',
  },
  {
    keywords: ['biblored', 'chapinero'],
    lat: 4.6483, lng: -74.0626,
    name: 'BibloRed Chapinero',
  },
  {
    keywords: ['biblored', 'suba'],
    lat: 4.7518, lng: -74.0839,
    name: 'BibloRed Suba',
  },
  {
    keywords: ['biblored', 'usme'],
    lat: 4.5034, lng: -74.1296,
    name: 'BibloRed Usme',
  },
  {
    keywords: ['biblored', 'bosa'],
    lat: 4.6169, lng: -74.1900,
    name: 'BibloRed Bosa',
  },
  {
    keywords: ['biblored', 'kennedy'],
    lat: 4.6285, lng: -74.1590,
    name: 'BibloRed Kennedy',
  },
  {
    keywords: ['biblored', 'fontibon'],
    lat: 4.6697, lng: -74.1438,
    name: 'BibloRed Fontibón',
  },
  {
    keywords: ['biblored', 'engativa'],
    lat: 4.6964, lng: -74.1103,
    name: 'BibloRed Engativá',
  },
  {
    keywords: ['biblored', 'la candelaria'],
    lat: 4.5981, lng: -74.0747,
    name: 'BibloRed La Candelaria',
  },
  {
    keywords: ['biblored', 'antonio narino'],
    lat: 4.5859, lng: -74.1049,
    name: 'BibloRed Antonio Nariño',
  },
  {
    keywords: ['pedregal'],
    lat: 4.5538, lng: -74.1357,
    name: 'Biblioteca La Pedregal',
  },
  {
    keywords: ['rafaelito', 'pombo'],
    lat: 4.6584, lng: -74.0954,
    name: 'Bibliored Rafaelito Pombo (Virgilio Barco)',
  },

  // ── Centros de Felicidad (Alcaldía de Bogotá) ─────────────────────────────
  {
    keywords: ['felicidad', 'chapinero'],
    lat: 4.6398, lng: -74.0589,
    name: 'Centro de Felicidad Chapinero',
  },
  {
    keywords: ['felicidad', 'bosa'],
    lat: 4.6108, lng: -74.1878,
    name: 'Centro de Felicidad Bosa',
  },
  {
    keywords: ['felicidad', 'kennedy'],
    lat: 4.6285, lng: -74.1590,
    name: 'Centro de Felicidad Kennedy',
  },
  {
    keywords: ['felicidad', 'usme'],
    lat: 4.5120, lng: -74.1300,
    name: 'Centro de Felicidad Usme',
  },
  {
    keywords: ['felicidad', 'suba'],
    lat: 4.7487, lng: -74.0921,
    name: 'Centro de Felicidad Suba',
  },
  {
    keywords: ['felicidad', 'engativa'],
    lat: 4.6964, lng: -74.1103,
    name: 'Centro de Felicidad Engativá',
  },
  {
    keywords: ['felicidad', 'fontibon'],
    lat: 4.6697, lng: -74.1438,
    name: 'Centro de Felicidad Fontibón',
  },
  {
    keywords: ['felicidad', 'rafael uribe'],
    lat: 4.5660, lng: -74.1002,
    name: 'Centro de Felicidad Rafael Uribe Uribe',
  },
  {
    keywords: ['felicidad', 'ciudad bolivar'],
    lat: 4.5360, lng: -74.1430,
    name: 'Centro de Felicidad Ciudad Bolívar',
  },
  {
    keywords: ['felicidad', 'san cristobal'],
    lat: 4.5570, lng: -74.0900,
    name: 'Centro de Felicidad San Cristóbal',
  },

  // ── Planetario de Bogotá ──────────────────────────────────────────────────
  {
    keywords: ['planetario'],
    lat: 4.6534, lng: -74.0836,
    name: 'Planetario de Bogotá',
  },

  // ── Jardín Botánico ───────────────────────────────────────────────────────
  {
    keywords: ['jardin', 'botanico'],
    lat: 4.6588, lng: -74.1005,
    name: 'Jardín Botánico de Bogotá José Celestino Mutis',
  },

  // ── Maloka ────────────────────────────────────────────────────────────────
  {
    keywords: ['maloka'],
    lat: 4.6465, lng: -74.1067,
    name: 'Maloka',
  },

  // ── Parque Simón Bolívar ──────────────────────────────────────────────────
  {
    keywords: ['parque', 'simon', 'bolivar'],
    lat: 4.6581, lng: -74.0937,
    name: 'Parque Simón Bolívar',
  },

  // ── Museo de los Niños ────────────────────────────────────────────────────
  {
    keywords: ['museo', 'ninos'],
    lat: 4.6462, lng: -74.1002,
    name: 'Museo de los Niños',
  },

  // ── Cinemateca de Bogotá ──────────────────────────────────────────────────
  {
    keywords: ['cinemateca'],
    lat: 4.6088, lng: -74.0745,
    name: 'Cinemateca de Bogotá',
  },

  // ── Museo Nacional ────────────────────────────────────────────────────────
  {
    keywords: ['museo', 'nacional', 'colombia'],
    lat: 4.6136, lng: -74.0668,
    name: 'Museo Nacional de Colombia',
  },

  // ── Idartes ───────────────────────────────────────────────────────────────
  {
    keywords: ['idartes'],
    lat: 4.5953, lng: -74.0769,
    name: 'Instituto Distrital de las Artes (Idartes)',
  },

  // ── Teatro Mayor Julio Mario Santodomingo ─────────────────────────────────
  {
    keywords: ['teatro', 'mayor'],
    lat: 4.6603, lng: -74.0997,
    name: 'Teatro Mayor Julio Mario Santodomingo',
  },

  // ── Centro Cultural Gabriel García Márquez ────────────────────────────────
  {
    keywords: ['garcia', 'marquez'],
    lat: 4.5980, lng: -74.0730,
    name: 'Centro Cultural Gabriel García Márquez',
  },

  // ── Banco de la República (sedes culturales) ──────────────────────────────
  {
    keywords: ['banco', 'republica', 'bogota'],
    lat: 4.5967, lng: -74.0741,
    name: 'Banco de la República Bogotá (Luis Ángel Arango)',
  },

  // ── Parque El Country ─────────────────────────────────────────────────────
  {
    keywords: ['country', 'usaquen'],
    lat: 4.6969, lng: -74.0534,
    name: 'Parque El Country (Usaquén)',
  },

  // ── Colsubsidio ───────────────────────────────────────────────────────────
  {
    keywords: ['colsubsidio'],
    lat: 4.6473, lng: -74.0967,
    name: 'Colsubsidio',
  },

  // ── Parque Nacional Olaya Herrera ─────────────────────────────────────────
  {
    keywords: ['parque', 'nacional', 'olaya'],
    lat: 4.6283, lng: -74.0650,
    name: 'Parque Nacional Olaya Herrera',
  },
];
