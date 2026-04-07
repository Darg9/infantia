// =============================================================================
// HabitaPlan - Core Type Definitions
// =============================================================================

// --- Enums ---

export type ActivityType = 'recurring' | 'one_time' | 'camp' | 'workshop';
export type ActivityStatus = 'active' | 'paused' | 'expired' | 'draft';
export type PricePeriod = 'per_session' | 'monthly' | 'total' | 'free';
export type SourceType = 'manual' | 'provider' | 'scraping';
export type ProviderType = 'academy' | 'independent' | 'institution' | 'government';
export type UserRole = 'user' | 'provider' | 'admin';
export type ScrapingPlatform = 'website' | 'instagram' | 'facebook' | 'telegram' | 'tiktok' | 'x' | 'whatsapp';
export type ScrapingStatus = 'running' | 'success' | 'partial' | 'failed';

// --- Core Entities ---

export interface Activity {
  id: string;
  title: string;
  description: string;
  type: ActivityType;
  status: ActivityStatus;
  startDate: Date;
  endDate?: Date;
  schedule?: ActivitySchedule;
  ageMin?: number;
  ageMax?: number;
  price?: number;
  priceCurrency: string;
  pricePeriod?: PricePeriod;
  capacity?: number;
  imageUrl?: string;
  providerId: string;
  locationId: string;
  verticalId: string;
  categories: string[];
  sourceType: SourceType;
  sourceUrl?: string;
  sourcePlatform?: string;
  sourceConfidence: number;
  sourceCapturedAt?: Date;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivitySchedule {
  days: string[];
  start: string;
  end: string;
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  logoUrl?: string;
  isVerified: boolean;
  isClaimed: boolean;
  verificationDate?: Date;
  ratingAvg?: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  cityId?: string;
  neighborhood?: string;
  notificationPrefs: NotificationPrefs;
  role: UserRole;
  createdAt: Date;
}

export interface NotificationPrefs {
  email: boolean;
  push: boolean;
  frequency: 'daily' | 'weekly' | 'realtime';
}

export interface Child {
  id: string;
  userId: string;
  name: string;
  birthDate: Date;
  interests: string[];
}

export interface Location {
  id: string;
  name: string;
  address: string;
  neighborhood?: string;
  cityId: string;
  latitude: number;
  longitude: number;
  isVirtual: boolean;
}

export interface City {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  timezone: string;
  currency: string;
  isActive: boolean;
}

export interface Vertical {
  id: string;
  slug: string;
  name: string;
  description: string;
  targetAudience: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  config: Record<string, unknown>;
}

export interface Category {
  id: string;
  verticalId: string;
  parentId?: string;
  name: string;
  slug: string;
  icon?: string;
  sortOrder: number;
}

// --- Interaction Entities ---

export interface Favorite {
  userId: string;
  activityId: string;
  createdAt: Date;
}

export interface Rating {
  id: string;
  userId: string;
  activityId: string;
  score: number;
  comment?: string;
  providerReply?: string;
  createdAt: Date;
}

// --- Scraping Entities ---

export interface ScrapingSource {
  id: string;
  name: string;
  platform: ScrapingPlatform;
  url: string;
  cityId: string;
  verticalId: string;
  scraperType: string;
  scheduleCron: string;
  isActive: boolean;
  lastRunAt?: Date;
  lastRunStatus?: ScrapingStatus;
  lastRunItems?: number;
  config?: Record<string, unknown>;
  notes?: string;
}

export interface ScrapingLog {
  id: string;
  sourceId: string;
  startedAt: Date;
  finishedAt?: Date;
  status: ScrapingStatus;
  itemsFound: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsDuplicated: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}
