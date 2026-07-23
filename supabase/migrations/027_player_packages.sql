create table if not exists public.player_packages (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts(id) on delete cascade,
  player_seat_id uuid not null references public.player_seats(id) on delete cascade,
  identity_assignment_id uuid references public.player_identity_assignments(id) on delete set null,
  package_order integer not null default 1,
  package_title text not null default '',
  current_identity text not null default '',
  read_order integer not null default 1,
  package_type text not null default 'initial',
  content_json jsonb not null default '{}'::jsonb,
  word_count integer not null default 0,
  generation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_packages_package_type_check
    check (package_type in ('initial', 'act', 'supplement', 'ending')),
  constraint player_packages_generation_status_check
    check (generation_status in ('pending', 'running', 'completed', 'failed')),
  unique(script_id, player_seat_id, package_order)
);

create index if not exists idx_player_packages_script
  on public.player_packages(script_id);

create index if not exists idx_player_packages_player_seat
  on public.player_packages(player_seat_id);

create index if not exists idx_player_packages_identity_assignment
  on public.player_packages(identity_assignment_id);

create index if not exists idx_player_packages_script_read_order
  on public.player_packages(script_id, read_order);

alter table public.player_packages enable row level security;

drop policy if exists "作者可管理自己剧本的玩家资料包" on public.player_packages;
create policy "作者可管理自己剧本的玩家资料包" on public.player_packages
  for all using (
    exists (
      select 1
      from public.scripts
      where scripts.id = player_packages.script_id
        and scripts.author_id = auth.uid()
    )
  );

drop trigger if exists update_player_packages_updated_at on public.player_packages;
create trigger update_player_packages_updated_at before update on public.player_packages
  for each row execute function public.update_updated_at_column();
