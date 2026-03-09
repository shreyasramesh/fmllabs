# fml labs

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
