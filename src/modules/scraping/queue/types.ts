export type ScrapingJobType = 'batch' | 'instagram';

export interface BatchJobData {
  type: 'batch';
  url: string;
  cityName: string;
  verticalSlug: string;
  maxPages?: number;
  sitemapPatterns?: string[];
}

export interface InstagramJobData {
  type: 'instagram';
  profileUrl: string;
  cityName: string;
  verticalSlug: string;
}

export type ScrapingJobData = BatchJobData | InstagramJobData;

export interface ScrapingJobResult {
  type: ScrapingJobType;
  url: string;
  discoveredLinks?: number;
  filteredLinks?: number;
  saved: number;
  failed: number;
  durationMs: number;
}
