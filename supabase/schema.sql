-- Run once in Supabase → SQL Editor (free project is enough).
-- Per-user cloud backup for 重启笔记 (RLS: each user only sees own row).

create table if not exists public.planner_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.planner_state enable row level security;

drop policy if exists "Users manage own planner state" on public.planner_state;
create policy "Users manage own planner state"
  on public.planner_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Per-user AI keys (cover + Workers AI text). Never shared across accounts.
create table if not exists public.user_cover_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'siliconflow',
  cloudflare_account_id text not null default '',
  cloudflare_token text not null default '',
  siliconflow_key text not null default '',
  pollinations_key text not null default '',
  configured_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_cover_keys enable row level security;

drop policy if exists "Users manage own cover keys" on public.user_cover_keys;
create policy "Users manage own cover keys"
  on public.user_cover_keys
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
