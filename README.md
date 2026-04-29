# Bloom

A free AI-powered website rebuilder for local businesses. Paste a URL, get an instant single-page rebuild via Claude. Tagline: *"Your local business deserves a second bloom."*

Includes:
- **Public landing page** — URL input, live before/after preview using `/api/preview`
- **Admin CRM** at `/admin` — password-gated, real seeded leads, outreach copilot chat (Claude Sonnet 4.6)

## Required env vars (set on Vercel)

```
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_PASSWORD=pick-a-strong-one
ANTHROPIC_MODEL=claude-sonnet-4-6   # optional, default
```

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

## Architecture

- Next.js 14 App Router on Vercel
- Anthropic SDK server-side (keys never leave the API routes)
- Lead state persisted in `localStorage` for v0 (swap for Postgres/KV when scaling)
- Seed leads in `data/leads.json` — 13 verified real US local businesses with bad websites

## Brand
- Name: Bloom
- Tagline: *Your local business deserves a second bloom.*
- Voice: warm, premium, founder-led, plainspoken
- Colors: ink #0A0A0A, paper #FAFAF7, accent #FF5C26 (coral/rose)

