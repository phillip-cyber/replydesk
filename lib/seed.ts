import seedRaw from '@/data/leads.json';
import type { Lead, SeedLead } from './types';

function slugId(s: SeedLead, i: number): string {
  const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}-${i}`;
}

export function getSeedLeads(): Lead[] {
  return (seedRaw as SeedLead[]).map((s, i) => ({
    ...s,
    id: slugId(s, i),
    // Respect seed JSON values when present so Apr 29 sent-state survives
    status: s.status ?? 'new',
    outreachSent: s.outreachSent ?? false,
    responded: false,
    internalNotes: s.internalNotes ?? '',
  }));
}
