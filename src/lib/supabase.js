import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars. Copy .env.example to .env and fill in your credentials.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

/* ─── SQL to run in Supabase SQL Editor ──────────────────────────────────────

-- Enable Row Level Security
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

-- RLS policies
alter table public.grocery_items enable row level security;
alter table public.purchases enable row level security;

create policy "Users see own items" on public.grocery_items
  for all using (auth.uid() = user_id);

create policy "Users see own purchases" on public.purchases
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────── */
