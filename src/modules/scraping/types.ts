import { z } from 'zod';

export type ScrapedRawData = {
  url: string;
  html?: string;
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
  title: z.string().min(1),
  description: z.string().nullable().default(''),
  categories: z.array(z.string()).min(1),
  minAge: z.number().int().min(0).max(99).nullable().optional(),
  maxAge: z.number().int().min(0).max(99).nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  pricePeriod: z.enum(['PER_SESSION', 'MONTHLY', 'TOTAL', 'FREE']).nullable().optional(),
  currency: z.string().length(3).nullable().default('COP'),
  location: z.object({
    address: coerceString,
    city: coerceString,
  }).nullable().optional(),
  schedules: z.array(z.object({
    startDate: z.string(),
    endDate: coerceString,
    notes: coerceString,
  })).nullable().optional(),
  confidenceScore: z.number().min(0).max(1),
});

export type ActivityNLPResult = z.infer<typeof activityNLPResultSchema>;

export type DiscoveredLink = {
  url: string;
  anchorText: string;
};

export const discoveredActivityUrlsSchema = z.object({
  activityUrls: z.array(z.string()),
});

export type BatchPipelineResult = {
  sourceUrl: string;
  discoveredLinks: number;
  filteredLinks: number;
  results: Array<{
    url: string;
    data: ActivityNLPResult | null;
    error?: string;
  }>;
};
