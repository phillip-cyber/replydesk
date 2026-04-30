// Existing CRM lead types (kept for /admin)
export type LeadStatus =
  | 'new'
  | 'queued'
  | 'sent'
  | 'replied'
  | 'meeting'
  | 'won'
  | 'lost'
  | 'blocked';

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-gray-100 text-gray-700 border-gray-200',
  queued: 'bg-blue-50 text-blue-700 border-blue-200',
  sent: 'bg-amber-50 text-amber-800 border-amber-200',
  replied: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  meeting: 'bg-violet-50 text-violet-700 border-violet-200',
  won: 'bg-green-100 text-green-800 border-green-300',
  lost: 'bg-rose-50 text-rose-700 border-rose-200',
  blocked: 'bg-stone-800 text-white border-stone-900',
};

export type Lead = {
  id: string;
  name: string;
  website: string;
  city: string;
  state: string;
  type: string;
  ownerName: string;
  linkedinUrl: string;
  contactEmail: string;
  emails?: string[];
  notes: string;
  status: LeadStatus;
  outreachSent: boolean;
  responded: boolean;
  interviewed?: boolean;
  betaUser?: boolean;
  lastTouch?: string;
  internalNotes?: string;
  enrichedAt?: number;
  // Notion-style rich fields
  whyTarget?: string;
  keyTakeaways?: string;
  proposedEmailSubject?: string;
  proposedEmailBody?: string;
  proposedLinkedinNote?: string; // The connection invite note (≤300 chars)
  proposedDmMessage?: string;
  contactPlatform?: 'LinkedIn DM' | 'Email' | 'X / Twitter DM' | 'Reddit DM' | '';
  bloomPreviewUrl?: string; // /?prefill=...
  // Send tracking
  lastEmailAt?: number;
  lastEmailTo?: string;
  lastPlatform?: string;
  // LinkedIn invite tracking (separate channel from email outreach)
  linkedinInviteSent?: boolean;
  linkedinInviteSentAt?: number;
};

// Helper used everywhere
export function leadHasContactInfo(l: Pick<Lead, 'linkedinUrl' | 'contactEmail' | 'emails'>): boolean {
  if (l.linkedinUrl && l.linkedinUrl.length > 0) return true;
  if (l.contactEmail && l.contactEmail.length > 0) return true;
  if (l.emails && l.emails.length > 0) return true;
  return false;
}

export type SeedLead = Omit<Lead, 'id' | 'responded' | 'lastTouch'> & {
  // status/outreachSent/internalNotes are optional in seed JSON; seed.ts fills defaults
  status?: LeadStatus;
  outreachSent?: boolean;
  internalNotes?: string;
};

// ——— Review intelligence types ———

import type { AgentKey } from './agents';

export type AnalyzedReview = {
  id: string; // hash of (author + time)
  author: string;
  rating: number;
  text: string;
  time: number;
  relativeTime?: string;
  // Agent-derived
  agent: AgentKey;
  sentiment: 'positive' | 'mixed' | 'negative';
  themes: string[];
  draftedReply: string;
  status: 'new' | 'reply-drafted' | 'replied' | 'archived';
};

export type ReportSummary = {
  placeId: string;
  placeName: string;
  address?: string;
  rating?: number;
  totalReviews?: number;
  websiteResolved?: string;

  // Aggregate
  overallSentiment: 'positive' | 'mixed' | 'negative';
  positiveThemes: string[];
  negativeThemes: string[];
  emergingPatterns: string[];

  // Per-agent outputs
  echoSampleReply: { reviewSnippet: string; reply: string } | null;
  atlasActionItems: string[];
  sageMenuMentions: { dish: string; sentiment: 'positive' | 'mixed' | 'negative'; mentions: number }[];
  argusCompetitors: { name: string; rating?: number; totalReviews?: number; takeaway: string }[];

  // Reviews (limited in free preview, full in dashboard)
  reviews: AnalyzedReview[];
  freePreview: boolean; // true = limited data, false = full dashboard data
};
