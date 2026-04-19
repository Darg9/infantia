import { z } from 'zod';

export type ScrapedRawData = {
  url: string;
  html?: string;
  ogImage?: string;
  sourceText: string;
  extractedAt: Date;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
};

export interface Extractor {
  extract(url: string): Promise<ScrapedRawData>;
}

// Helper: Gemini tiende a devolver null en campos string vacíos.
// coerceString acepta string o null, convirtiendo null → undefined.
const coerceString = z.string().nullable().optional().transform((v) => v ?? undefined);

export const activityNLPResultSchema = z.object({
  // Gemini puede devolver null o string vacío en title — normalizamos a 'Sin título'
  title: z.union([z.string(), z.null()]).transform((v) => (v && v.trim()) ? v.trim() : 'Sin título'),
  description: z.string().nullable().default(''),
  // Gemini puede devolver null o [] en categories — normalizamos a ['General']
  categories: z.union([z.array(z.string()), z.null()])
    .transform((v) => (v && v.length > 0) ? v : ['General']),
  minAge: z.number().int().min(0).max(120).nullable().optional(),
  maxAge: z.number().int().min(0).max(120).nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  pricePeriod: z.enum(['PER_SESSION', 'MONTHLY', 'TOTAL', 'FREE']).nullable().optional(),
  currency: z.string().length(3).nullable().default('COP'),
  // KIDS=solo niños | FAMILY=padres+hijos | ADULTS=solo adultos | ALL=sin info clara
  audience: z.enum(['KIDS', 'FAMILY', 'ADULTS', 'ALL']).nullable().optional().default('ALL'),
  location: z.object({
    address: coerceString,
    city: coerceString,
  }).nullable().optional(),
  schedules: z.array(z.object({
    startDate: z.string(),
    endDate: coerceString,
    notes: coerceString,
  })).nullable().optional(),
  environment: z.enum(['INDOOR', 'OUTDOOR', 'MIXED']).nullable().optional(),
  confidenceScore: z.number().min(0).max(1),
  imageUrl: z.string().url().nullable().optional(),
});

export type ActivityNLPResult = z.infer<typeof activityNLPResultSchema>;

export type DiscoveredLink = {
  url: string;
  anchorText: string;
  /** ISO date string extraída del <lastmod> del sitemap. Presente solo en fuentes XML. */
  lastmod?: string;
};

export const discoveredActivityUrlsSchema = z.object({
  indices: z.array(z.number().int().positive()),
});

export type BatchPipelineResult = {
  sourceUrl: string;
  /** ID de ScrapingSource en BD (TEXT). Presente cuando el pipeline tiene logger configurado. */
  sourceId?: string | null;
  discoveredLinks: number;
  filteredLinks: number;
  /** Número real de actividades persistidas en BD (excluye baja confianza, rechazos de calidad y errores). */
  savedCount?: number;
  /** Métricas del parser (Gemini vs fallback) para este batch. */
  parserMetrics?: {
    geminiOk: number;
    fallbackCount: number;
  };
  results: Array<{
    url: string;
    data: ActivityNLPResult | null;
    error?: string;
  }>;
};

// ── Instagram Types ──

export type InstagramPost = {
  url: string;
  caption: string;
  imageUrls: string[];
  timestamp: string | null;
  likesCount: number | null;
};

export type InstagramProfileData = {
  username: string;
  bio: string;
  followerCount: number | null;
  posts: InstagramPost[];
  profileUrl: string;
};

export type InstagramPipelineResult = {
  profileUrl: string;
  username: string;
  postsExtracted: number;
  /** Número real de actividades persistidas en BD. */
  savedCount?: number;
  results: Array<{
    postUrl: string;
    data: ActivityNLPResult | null;
    error?: string;
  }>;
};
