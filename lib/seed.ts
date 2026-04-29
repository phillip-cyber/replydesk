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
    status: 'new',
    outreachSent: false,
    responded: false,
    internalNotes: '',
  }));
}
