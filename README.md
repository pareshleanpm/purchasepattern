# GroCart 🛒

**Smart Grocery Logger** — log every grocery purchase and get AI-powered reorder recommendations based on your buying patterns.

---

## Features
- 📋 **Log purchases** with quantity, price, store, date, notes
- 🧠 **Smart recommendations** — learns your purchase frequency per item and tells you when you're due to restock
- 📊 **Dashboard** — weekly/monthly stats, spending tracker (₹), top items
- 📜 **History** — full purchase log with delete
- 🔐 **Auth** — Supabase email/password, per-user data with Row Level Security
- 📱 **PWA** — installable on Android (and iOS) as a native-feeling app
- 🌙 **Dark forest theme** — beautiful dark green UI

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Auth & DB | Supabase (PostgreSQL + RLS) |
| Hosting | Cloudflare Pages |
| PWA | vite-plugin-pwa + Workbox |
| Styling | Pure CSS, Google Fonts (Syne + DM Sans) |

---

## Step 1 — Set up Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Open **SQL Editor** and paste the SQL block from `src/lib/supabase.js` (between the comment lines)
3. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key

---

## Step 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Step 3 — Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Step 4 — Deploy to Cloudflare Pages

### Option A: GitHub (recommended)

1. Push this repo to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com) → Create application → Connect to Git
3. Select your repo
4. Set build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Add environment variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
6. Deploy!

### Option B: Wrangler CLI

```bash
npm run build
npx wrangler pages deploy dist --project-name grocart
```

---

## Step 5 — Install on Android 📱

Once deployed to Cloudflare Pages:

1. Open your app URL in **Chrome on Android**
2. Tap the **three-dot menu** (⋮) → **Add to Home screen**
3. Tap **Add**

The app will appear on your home screen and open in full-screen mode like a native app. It also works **offline** for cached pages via the service worker.

> **iOS:** Open in Safari → Share → Add to Home Screen

---

## Recommendation Engine

The smart reorder system works as follows:

1. **For items with 2+ purchases**: calculates average days between each purchase
2. **For items with only 1 purchase**: uses category-based defaults (e.g. Dairy=7d, Vegetables=5d, Spices=45d)
3. **Urgency levels**:
   - 🔴 **Overdue** — past the predicted restock date by >10%
   - 🟡 **Due Soon** — within 20% of the predicted date
   - 🟢 **Upcoming** — 60–80% through the purchase cycle
4. **Confidence**: `high` (3+ purchases), `medium` (2), `low` (1 — category default used)

The more you log, the smarter it gets!

---

## Project Structure

```
grocart/
├── public/
│   ├── favicon.svg
│   └── _redirects          # Cloudflare SPA routing
├── src/
│   ├── hooks/
│   │   ├── useAuth.jsx      # Auth context
│   │   └── useGroceryData.js # CRUD with Supabase
│   ├── lib/
│   │   ├── supabase.js      # Supabase client + SQL schema
│   │   └── recommendations.js # Pattern analysis engine
│   ├── pages/
│   │   ├── AuthPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── LogPage.jsx
│   │   ├── RecommendationsPage.jsx
│   │   └── HistoryPage.jsx
│   ├── App.jsx              # Shell + bottom nav
│   ├── main.jsx
│   └── styles.css           # Full design system
├── index.html
├── vite.config.js           # PWA config
├── package.json
└── .env.example
```

---

## Supabase SQL (copy this into SQL Editor)

```sql
create extension if not exists "uuid-ossp";

create table if not exists public.grocery_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null default 'Other',
  unit text not null default 'pcs',
  created_at timestamptz default now()
);

create table if not exists public.purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  item_id uuid references public.grocery_items(id) on delete cascade not null,
  quantity numeric not null default 1,
  price_per_unit numeric,
  store text,
  purchased_at timestamptz default now(),
  notes text
);

alter table public.grocery_items enable row level security;
alter table public.purchases enable row level security;

create policy "Users see own items" on public.grocery_items
  for all using (auth.uid() = user_id);

create policy "Users see own purchases" on public.purchases
  for all using (auth.uid() = user_id);
```
