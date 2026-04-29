// The Bloom team — five named AI agents that handle review intelligence end-to-end.

export type AgentKey = 'iris' | 'echo' | 'atlas' | 'sage' | 'argus';

export type Agent = {
  key: AgentKey;
  name: string;
  role: string;
  letter: string;
  oneLiner: string;
  longBlurb: string;
};

export const AGENTS: Record<AgentKey, Agent> = {
  iris: {
    key: 'iris',
    name: 'Iris',
    role: 'The Listener',
    letter: 'I',
    oneLiner: 'Reads every review.',
    longBlurb:
      'Iris connects to your Google Business Profile, pulls every review, and keeps watching for new ones. She is the eyes of the team.',
  },
  echo: {
    key: 'echo',
    name: 'Echo',
    role: 'The Responder',
    letter: 'E',
    oneLiner: 'Drafts a reply for every review.',
    longBlurb:
      'Echo writes a tone-matched response to every review — warm for the warm ones, careful for the difficult ones. You approve with one click.',
  },
  atlas: {
    key: 'atlas',
    name: 'Atlas',
    role: 'The Strategist',
    letter: 'A',
    oneLiner: 'Weekly action items from the patterns.',
    longBlurb:
      'Atlas reads across every review and turns the noise into a short list of operational fixes you can actually do this week.',
  },
  sage: {
    key: 'sage',
    name: 'Sage',
    role: 'The Analyst',
    letter: 'S',
    oneLiner: 'Menu intel + sentiment trends.',
    longBlurb:
      'Sage tracks which dishes customers love, which they complain about, and how your sentiment is moving over time.',
  },
  argus: {
    key: 'argus',
    name: 'Argus',
    role: 'The Watcher',
    letter: 'G',
    oneLiner: 'Tracks the competition.',
    longBlurb:
      'Argus watches the restaurants nearest you and surfaces what their customers are saying — so you know where the openings are.',
  },
};

export const AGENT_LIST: Agent[] = ['iris', 'echo', 'atlas', 'sage', 'argus'].map(
  (k) => AGENTS[k as AgentKey]
);

// Assigns a primary agent to a review based on its content/sentiment.
// Used for the CRM "owner" column.
export function assignAgent(review: { rating: number; text: string }): AgentKey {
  const t = review.text.toLowerCase();
  if (review.rating <= 2) return 'echo'; // negative → Echo drafts careful response
  if (/menu|dish|order|tasted|tried|sauce|portion|fresh|cold|burn|spicy/.test(t)) return 'sage';
  if (/wait|service|server|host|rude|slow|fast|attentive/.test(t)) return 'atlas';
  if (review.rating >= 4) return 'echo'; // positive → Echo handles the thank-you
  return 'iris';
}
