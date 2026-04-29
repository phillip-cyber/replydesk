# Deploy Bloom to Vercel

## One-time setup (~3 minutes)

```bash
cd ~/Documents/Zilla-Workspace/mainstreet
npx vercel --prod
```

That's it for code. The CLI will:
1. Prompt you to login (browser flow, ~10 sec)
2. Ask which scope: pick **`phillip-4405's projects`**
3. Ask "Set up and deploy?" → **y**
4. Ask "Link to existing project?" → **N** (new project)
5. Ask project name → press enter for `mainstreet`
6. Ask code directory → press enter (`./`)
7. Ask "Want to override settings?" → **N**

It'll build and give you a live URL like `https://mainstreet-xxx.vercel.app`.

## Then: set env vars (required for AI features)

In the **Vercel dashboard** → your project → **Settings → Environment Variables**, add:

| Key | Value | Environments |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (from console.anthropic.com) | Production, Preview, Development |
| `ADMIN_PASSWORD` | pick any strong password | Production, Preview, Development |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` (optional, default) | All |

Then redeploy: in dashboard → **Deployments** → most recent → ⋯ → **Redeploy**.
Or from CLI: `npx vercel --prod` again.

## After deploy

- **Public landing**: `https://mainstreet-xxx.vercel.app/`
- **Admin CRM**: `https://mainstreet-xxx.vercel.app/admin` (use your `ADMIN_PASSWORD`)

## Future deploys

```bash
cd ~/Documents/Zilla-Workspace/mainstreet
git add -A && git commit -m "..."
npx vercel --prod
```

Or connect a GitHub repo for auto-deploy on push.
