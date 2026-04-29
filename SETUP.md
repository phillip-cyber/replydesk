# Bloom — Auth + Payments setup (~10 min)

The site is live at https://bloom-psi-jet.vercel.app. The full flow (paste URL → AI rebuild → Google login → Stripe pay $10 → download HTML) needs 6 env vars in Vercel. Here's how.

## 1. Google OAuth (~3 min)

1. Go to https://console.cloud.google.com/apis/credentials
2. If you don't have a project, create one (any name)
3. Click **+ Create Credentials → OAuth client ID**
4. Application type: **Web application**
5. Name: `Bloom`
6. **Authorized JavaScript origins:**
   - `https://bloom-psi-jet.vercel.app`
   - (later, also add your custom domain like `https://trybloomsites.ai`)
7. **Authorized redirect URIs:**
   - `https://bloom-psi-jet.vercel.app/api/auth/callback/google`
   - (later, also add `https://trybloomsites.ai/api/auth/callback/google`)
8. Click **Create**
9. Copy the **Client ID** and **Client Secret** — you'll paste them into Vercel below

> If Google asks you to configure a "consent screen" first, do it: User Type = External, App name = Bloom, support email = your email, developer email = your email. Save and continue through the scopes screen (no scopes needed beyond default), then Test users → add your own email. Publish later when ready.

## 2. Stripe ($10 product) (~3 min)

1. Go to https://dashboard.stripe.com/test/products (use test mode for now)
2. Click **+ Add product**
3. Name: `Bloom — Full site source`
4. Pricing model: **One-time**
5. Price: **$10.00 USD**
6. Click **Save product**
7. On the product page, copy the **Price ID** (starts with `price_...`)
8. Go to https://dashboard.stripe.com/test/apikeys
9. Copy the **Secret key** (starts with `sk_test_...`)

When you're ready for real money, repeat in live mode (same screens, no `/test/` in URL) and swap the keys in Vercel.

## 3. NEXTAUTH_SECRET

Run this in any terminal:

```bash
openssl rand -base64 32
```

Copy the output. (Or use https://generate-secret.vercel.app/32)

## 4. Add all env vars to Vercel

Go to https://vercel.com/felix-e565c1e3/bloom/settings/environment-variables and add each (Production + Preview):

| Key | Value | Source |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Step 1 |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | Step 1 |
| `NEXTAUTH_SECRET` | (32 random bytes) | Step 3 |
| `NEXTAUTH_URL` | `https://bloom-psi-jet.vercel.app` | (your live URL) |
| `STRIPE_SECRET_KEY` | `sk_test_xxx` | Step 2 |
| `STRIPE_PRICE_ID` | `price_xxx` | Step 2 |

## 5. Tell me when done

Drop me a message ("env set") and I'll redeploy + smoke-test the full flow. Or run `npx vercel --prod` yourself, but I have your token so I can do it.

---

## Test flow once live

1. Open https://bloom-psi-jet.vercel.app
2. Paste any URL (try `oldesoulbarbershop.com`)
3. Watch the 4-agent loader for ~30 sec
4. See the side-by-side: real screenshot of their site (left) + AI rebuild (right)
5. Click **Get full access · $10**
6. Sign in with Google
7. Pay $10 with Stripe test card: `4242 4242 4242 4242`, any future date, any CVC
8. Land on `/success` → click **Download HTML** → file saves as `oldesoulbarbershop.com-bloom.html`
