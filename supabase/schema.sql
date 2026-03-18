create table if not exists public.demos (
  id text primary key,
  title text not null,
  module text not null default '',
  description text not null default '',
  focus_prompt text not null default '',
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id text primary key,
  demo_id text not null references public.demos(id) on delete cascade,
  mis text not null,
  role text not null default '',
  text text not null,
  device text not null default 'Web',
  created_at timestamptz not null default now(),
  is_new boolean not null default true
);

create index if not exists feedback_demo_id_created_at_idx
  on public.feedback (demo_id, created_at desc);

create index if not exists demos_updated_at_idx
  on public.demos (updated_at desc);
