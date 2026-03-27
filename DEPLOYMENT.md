# Deployment Guide: And Then What → Vercel

This guide walks you through pushing the project to Git and deploying to Vercel.

---

## 1. Push to Git

### Initialize and push (if not already a git repo)

```bash
# Initialize git
git init

# Add all files (respects .gitignore)
git add .

# First commit
git commit -m "Initial commit: And Then What decision-making app"

# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/and-then-what.git
git branch -M main
git push -u origin main
```

### Verify before pushing

- [ ] `.env.local` is **not** committed (it's in `.gitignore`)
- [ ] No API keys or secrets in the codebase
- [ ] `npm run build` succeeds locally

---

## 2. MongoDB Atlas (Production Database)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a free cluster (M0)
3. Create a database user (username + password)
4. Add your IP: **0.0.0.0/0** (allow from anywhere — Vercel uses dynamic IPs)
5. Get connection string: **Connect → Drivers → Node.js**
6. Replace `<password>` with your user password
7. Example: `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/and-then-what?retryWrites=true&w=majority`

---

## 3. Clerk (Authentication)

1. Go to [clerk.com](https://clerk.com) dashboard
2. Create an application (or use existing)
3. Get **Publishable Key** and **Secret Key**
4. Paths are configured in code (see `app/(auth)/sign-in` and `sign-up` pages):
   - Sign-in page: `/sign-in`, after sign-in → `/chat/new`
   - Sign-up page: `/sign-up`, after sign-up → `/chat/new`
5. After Vercel deploy: add your Vercel domain (e.g. `your-app.vercel.app`) under **Domains**

---

## 4. Deploy to Vercel

### Option A: Import from GitHub

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your GitHub repository
3. **Framework Preset**: Next.js (auto-detected)
4. **Root Directory**: `./` (default)
5. **Build Command**: `npm run build` (default)
6. **Output Directory**: `.next` (default)

### Environment Variables

Add these in Vercel → Project → Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `GEMINI_API_KEY` | Your key | From [Google AI Studio](https://aistudio.google.com/apikey) |
| `MONGODB_URI` | Atlas connection string | From step 2 |
| `ENCRYPTION_KEY` | 32-byte key, base64 | **Production:** required. Run `openssl rand -base64 32` once; store in Vercel secrets (never commit). Encrypts user content at rest in MongoDB (AES-256-GCM). Rotating the key requires re-encrypting existing documents (not automatic). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` | From Clerk |
| `CLERK_SECRET_KEY` | `sk_live_...` or `sk_test_...` | From Clerk |
| `RESEND_API_KEY` | Resend API key | Required for contact + weekly reflection emails |
| `CONTACT_FROM_EMAIL` | Verified sender address | Used as sender for outgoing mail |
| `CRON_SECRET` | Strong random string | Protects `/api/cron/weekly-reflections` |

**Optional:**
- `GEMINI_MODEL` — default: `gemini-2.5-flash-lite`
- `MONGODB_MAX_POOL_SIZE` — default: `10` (increase for M10+ clusters)

7. Click **Deploy**

### Scheduled Weekly Reflection Email

- The repo includes `vercel.json` cron config for `/api/cron/weekly-reflections` (runs daily at `14:00 UTC` to satisfy Hobby plan limits).
- The endpoint itself gates execution to **Sunday (America/New_York)** and requires `CRON_SECRET`.
- Weekly dedupe (`weekKey`) prevents duplicate sends if the route is invoked more than once.
- Manual test after deploy:
  - `GET https://<your-domain>/api/cron/weekly-reflections?force=1`
  - Header: `Authorization: Bearer <CRON_SECRET>`

---

## 5. Post-Deploy: Clerk Domains

1. In Clerk dashboard → **Configure → Domains**
2. Add your Vercel URL: `https://your-app.vercel.app`
3. Clerk will verify the domain

---

## 6. Verify Deployment

- Visit your Vercel URL
- Sign up / sign in
- Create a chat session
- Confirm mental models and AI responses work

---

## Mental Model Images (Optional)

The mental model illustrations (~10MB) are excluded from the repo to keep pushes fast. To add them in production:

1. **Vercel**: Upload the `public/images/*.png` folder via Vercel Dashboard → Project → Storage, or add images in a follow-up commit in smaller batches.
2. **Local dev**: Keep your images in `public/images/` — they work locally and are gitignored.

The app works without images (shows fallback); tiles and modals gracefully hide missing images.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails | Check Vercel build logs; ensure all env vars are set |
| "MongoServerError" | Verify `MONGODB_URI` and IP allowlist (0.0.0.0/0) |
| Clerk redirect loop | Add Vercel domain to Clerk; check sign-in/sign-up paths |
| PWA not installing | PWA requires HTTPS (Vercel provides this). Ensure `public/icons/icon-192.png` and `icon-512.png` are 192×192 and 512×512 px (run `npm run generate-icons` if needed). |

---

## Optional: Custom Domain

1. Vercel → Project → Settings → Domains
2. Add your domain and follow DNS instructions
3. Update Clerk with the new domain
