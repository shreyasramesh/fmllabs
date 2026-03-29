# fml labs

**Organize concepts, goals, and conversations so your past thinking actually shows up when you need it.**

A decision-making chat application that helps you think deeper. Uses mental models and cognitive biases from the index to surface relevant concepts and guide better decisions.

## Features

- **Clerk authentication** — Sign in, sign up, protected routes
- **MongoDB persistence** — Chat sessions and messages per user
- **Gemini 2.5 Flash** — AI coach for decision-making
- **Mental models integration** — Surfaces relevant cognitive biases from 55+ models
- **PWA** — Installable on mobile and desktop
- **Responsive** — Mobile, tablet, desktop

## Setup

### 1. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
GEMINI_API_KEY=          # From Google AI Studio
MONGODB_URI=             # MongoDB connection string (e.g. mongodb://localhost:27017/and-then-what)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Get Clerk keys from [clerk.com](https://clerk.com). Get Gemini API key from [Google AI Studio](https://aistudio.google.com/).

**Optional — data encryption:** Set `ENCRYPTION_KEY` (32 bytes, base64: `openssl rand -base64 32`) to AES-GCM–encrypt user content in MongoDB. Omit locally to store plaintext in dev; **production deployments should set it** (see [DEPLOYMENT.md](./DEPLOYMENT.md)).

### 2. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Clerk configuration

In the Clerk dashboard, set:

- **Sign-in URL**: `/sign-in`
- **Sign-up URL**: `/sign-up`
- **After sign-in URL**: `/chat/new`

## Project structure

- `app/` — Next.js App Router pages and API routes
- `lib/` — Gemini client, mental models loader, MongoDB
- `mental-models/` — YAML files for each mental model
- `mental-models-index.yaml` — Index with paths and descriptions

## Deployment (Vercel)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step instructions.

**Quick summary:**
1. Push to GitHub
2. Create MongoDB Atlas cluster and get connection string
3. In Vercel: Import repo → Add env vars → Deploy
4. Configure Clerk with production URLs

## Android app (Capacitor)

Android packaging and install instructions are documented in [ANDROID.md](./ANDROID.md).

## Perspective Deck Translation Workflow

Use this workflow whenever you add or update translated perspective decks.

### Translate decks and index

The script translates both the index (`perspective-decks-index-<lang>.yaml`) and all deck files. The index contains domain names, subdomain names, and deck descriptions—these appear in the carousel chips and UI.

Translate all non-English languages:

```bash
npm run translate-perspective-decks
```

Translate one language only:

```bash
npm run translate-perspective-decks -- --lang=bn
```

Skip files that already exist:

```bash
npm run translate-perspective-decks -- --skip-existing
```

Translate only the index (domain/subdomain names):

```bash
npm run translate-perspective-decks -- --index-only --lang=ta
```

Skip index translation (e.g. if index already exists):

```bash
npm run translate-perspective-decks -- --skip-index
```

### Verify YAML integrity (all languages)

Run:

```bash
npm run verify-perspective-decks
```

This checks every `perspective-decks/**/*.yaml` file for:
- YAML parse validity
- Required deck fields (`id`, `name`, `domain`, non-empty `cards`)
- Required card fields (`id`, `name`, `prompt`, non-empty `follow_ups`)
- `follow_ups` entries are non-empty strings
- `perspective-decks-index.yaml` has a non-empty `decks` array

### Adding a new language

1. Add the language to `LANGUAGES` in `scripts/translate-perspective-decks.mjs` (code + display name).
2. Generate translations:
   - `npm run translate-perspective-decks -- --lang=<new-code>`
3. Run verification:
   - `npm run verify-perspective-decks`
4. Fix any reported YAML issues (most common: malformed list items or unquoted `:` in follow-up text).
5. Re-run verification until it reports no issues.

## Mental Models Translation Workflow

Use this workflow whenever you add or update translated mental models.

### Translate mental models

Translate all non-English consolidated files:

```bash
npm run translate-mental-models
```

Translate one language only:

```bash
npm run translate-mental-models -- --lang=es
```

Skip files that already exist:

```bash
npm run translate-mental-models -- --skip-existing
```

### Fix structural issues (optional)

If verification reports missing fields, invalid IDs, or broken `related_content` references, run the automated fixer:

```bash
npm run fix-mental-models
```

Fix one language only:

```bash
npm run fix-mental-models -- --lang=es
```

The fixer normalizes IDs, backfills missing required fields from English, and cleans `related_content` to reference only existing models. Re-run `verify-mental-models` after fixing.

### Verify mental model YAML integrity

Run validation for all consolidated language files:

```bash
npm run verify-mental-models
```

Validate one language file only:

```bash
npm run verify-mental-models -- --lang=es
```

This checks each `mental-models/mental-models-<lang>.yaml` file for:
- YAML parse validity
- Presence of `mental_models` array
- Required fields per model:
  - `id`, `name`, `quick_introduction`, `in_more_detail`, `why_this_is_important`
  - `when_to_use`, `how_can_you_spot_it`, `examples`
  - `real_world_implications`, `professional_application`, `how_can_this_be_misapplied`
  - `related_content`
- Field type checks (arrays/objects/strings as expected)
- ID format (`snake_case` style, `[a-z0-9_]+`)
- Duplicate IDs within a file
- `related_content` IDs reference models that exist in the same file

### Adding a new mental-model language

1. Add the language to `LANGUAGES` in `scripts/translate-mental-models.mjs` (code + display name).
2. Generate translation:
   - `npm run translate-mental-models -- --lang=<new-code>`
3. Validate:
   - `npm run verify-mental-models -- --lang=<new-code>`
4. If verification fails, run the fixer:
   - `npm run fix-mental-models -- --lang=<new-code>`
5. Re-run verification until it passes with no issues.

### If you still have per-model folders

If your source is still split by model (`mental-models-<lang>/...`), consolidate first:

```bash
node scripts/consolidate-mental-models.mjs --lang=<code>
```

Then run:

```bash
npm run verify-mental-models -- --lang=<code>
```
