// =============================================================================
// Activities - Zod Validation Schemas
// =============================================================================

import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/config/constants';

// Enum values matching Prisma schema
const ActivityType = z.enum(['RECURRING', 'ONE_TIME', 'CAMP', 'WORKSHOP']);
const ActivityStatus = z.enum(['ACTIVE', 'PAUSED', 'EXPIRED', 'DRAFT']);
const PricePeriod = z.enum(['PER_SESSION', 'MONTHLY', 'TOTAL', 'FREE']);
const SourceType = z.enum(['MANUAL', 'PROVIDER', 'SCRAPING']);

export const listActivitiesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  verticalId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  ageMin: z.coerce.number().int().min(0).max(18).optional(),
  ageMax: z.coerce.number().int().min(0).max(18).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  status: ActivityStatus.optional(),
  type: ActivityType.optional(),
  search: z.string().trim().min(1).max(200).optional(),
}).refine(
  (data) => !(data.ageMin && data.ageMax && data.ageMin > data.ageMax),
  { message: 'ageMin must be <= ageMax', path: ['ageMin'] },
).refine(
  (data) => !(data.priceMin && data.priceMax && data.priceMin > data.priceMax),
  { message: 'priceMin must be <= priceMax', path: ['priceMin'] },
);

const scheduleSchema = z.object({
  days: z.array(z.string()),
  start: z.string(),
  end: z.string(),
}).optional();

export const createActivitySchema = z.object({
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().min(10),
  type: ActivityType,
  status: ActivityStatus.default('DRAFT'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  schedule: scheduleSchema,
  ageMin: z.number().int().min(0).max(18).optional(),
  ageMax: z.number().int().min(0).max(18).optional(),
  price: z.number().min(0).optional(),
  priceCurrency: z.string().max(3).default('COP'),
  pricePeriod: PricePeriod.optional(),
  capacity: z.number().int().min(1).optional(),
  imageUrl: z.string().url().optional(),
  providerId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  verticalId: z.string().uuid(),
  categoryIds: z.array(z.string().uuid()).optional(),
  sourceType: SourceType.default('MANUAL'),
  sourceUrl: z.string().url().optional(),
  sourcePlatform: z.string().max(50).optional(),
  sourceConfidence: z.number().min(0).max(1).default(0.5),
});

export const updateActivitySchema = createActivitySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

export type ListActivitiesInput = z.infer<typeof listActivitiesSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
