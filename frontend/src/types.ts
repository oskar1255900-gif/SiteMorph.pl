export interface GeneratedWebsite {
  title: string;
  category: string;
  domain: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  files: Record<string, string>;
}

export interface Lead {
  id: string;
  name: string;
  category?: string;
  industry?: string;
  location?: string;
  city?: string;
  country?: string;
  phone?: string;
  website?: string | null;
  websiteStatus?: string;
  readinessScore?: number;
  leadScore?: number;
  estBudget?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  osmId?: string;
  osmType?: string;
  rating?: number | null;
  userRatingsTotal?: number | null;
  openingHours?: string | null;
  photos?: string[];
}

export interface Invoice {
  id: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  status: 'Opłacona' | 'Oczekująca';
  date: string;
}

// ============================================================================
// 2. WARIANTY ANIMACJI
// ============================================================================
