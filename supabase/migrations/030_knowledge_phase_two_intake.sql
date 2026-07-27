create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null default 'manual' check (
    source_type in ('manual', 'txt', 'md', 'docx', 'pdf')
  ),
  storage_path text null,
  parsed_text text not null default '',
  parse_status text not null default 'pending' check (
    parse_status in ('pending', 'parsed', 'failed', 'needs_cleanup')
  ),
  parse_error text not null default '',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_documents_parse_status
  on public.knowledge_documents(parse_status, updated_at desc);

alter table public.knowledge_documents enable row level security;

create table if not exists public.knowledge_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed')
  ),
  parser_version text not null default '',
  extractor_model text not null default '',
  result_json jsonb not null default '{}',
  error_message text not null default '',
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_extraction_jobs_document
  on public.knowledge_extraction_jobs(document_id, created_at desc);
create index if not exists idx_knowledge_extraction_jobs_status
  on public.knowledge_extraction_jobs(status, created_at desc);

alter table public.knowledge_extraction_jobs enable row level security;

create table if not exists public.knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  document_id uuid null references public.knowledge_documents(id) on delete set null,
  extraction_job_id uuid null references public.knowledge_extraction_jobs(id) on delete set null,
  approved_knowledge_item_id uuid null references public.knowledge_items(id) on delete set null,
  title text not null,
  content text not null,
  category text not null check (
    category in (
      'structure_rule',
      'character_pattern',
      'clue_pattern',
      'timeline_pattern',
      'dm_flow_rule',
      'anti_novelization_rule',
      'quality_metric',
      'anti_pattern'
    )
  ),
  module_type text not null default 'case_core' check (
    module_type in (
      'case_core',
      'characters',
      'clues',
      'acts',
      'player_script',
      'dm_manual',
      'truth_review',
      'quality_check'
    )
  ),
  stage text not null check (
    stage in (
      'brief',
      'case_core',
      'characters',
      'clues',
      'acts',
      'player_script',
      'dm_manual',
      'review'
    )
  ),
  genre text null check (
    genre is null or genre in ('hardcore','emotion','horror','funny','mechanism')
  ),
  player_count_min integer null check (player_count_min is null or player_count_min between 1 and 12),
  player_count_max integer null check (player_count_max is null or player_count_max between 1 and 12),
  difficulty text null check (
    difficulty is null or difficulty in ('beginner','intermediate','advanced','expert')
  ),
  abstraction_level text not null default 'pattern' check (
    abstraction_level in ('summary', 'pattern', 'rule', 'anti_pattern', 'quality_metric')
  ),
  source_context jsonb not null default '{}',
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  review_status text not null default 'pending' check (
    review_status in ('pending', 'approved', 'rejected')
  ),
  reviewer_note text not null default '',
  weight integer not null default 100,
  metadata jsonb not null default '{}',
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_candidates_player_range_check check (
    player_count_min is null
    or player_count_max is null
    or player_count_min <= player_count_max
  )
);

create index if not exists idx_knowledge_candidates_review_status
  on public.knowledge_candidates(review_status, updated_at desc);
create index if not exists idx_knowledge_candidates_document
  on public.knowledge_candidates(document_id, created_at desc);
create index if not exists idx_knowledge_candidates_stage
  on public.knowledge_candidates(stage, category);

alter table public.knowledge_candidates enable row level security;

create or replace function public.approve_knowledge_candidate(
  p_candidate_id uuid,
  p_enabled boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.knowledge_candidates%rowtype;
  new_knowledge_item_id uuid;
begin
  select *
    into candidate
    from public.knowledge_candidates
   where id = p_candidate_id
   for update;

  if not found then
    raise exception 'knowledge candidate not found: %', p_candidate_id;
  end if;

  if candidate.review_status = 'approved' and candidate.approved_knowledge_item_id is not null then
    return candidate.approved_knowledge_item_id;
  end if;

  if candidate.review_status = 'rejected' then
    raise exception 'knowledge candidate has been rejected: %', p_candidate_id;
  end if;

  insert into public.knowledge_items (
    title,
    content,
    category,
    module_type,
    stage,
    genre,
    player_count_min,
    player_count_max,
    difficulty,
    enabled,
    weight,
    metadata
  ) values (
    candidate.title,
    candidate.content,
    candidate.category,
    candidate.module_type,
    candidate.stage,
    candidate.genre,
    candidate.player_count_min,
    candidate.player_count_max,
    candidate.difficulty,
    p_enabled,
    candidate.weight,
    candidate.metadata || jsonb_build_object(
      'source', 'knowledge_phase_two',
      'candidateId', candidate.id,
      'documentId', candidate.document_id,
      'extractionJobId', candidate.extraction_job_id,
      'abstractionLevel', candidate.abstraction_level,
      'sourceContext', candidate.source_context
    )
  )
  returning id into new_knowledge_item_id;

  update public.knowledge_candidates
     set review_status = 'approved',
         approved_knowledge_item_id = new_knowledge_item_id,
         reviewer_note = coalesce(nullif(reviewer_note, ''), 'Approved into knowledge_items.'),
         reviewed_at = now(),
         updated_at = now()
   where id = candidate.id;

  return new_knowledge_item_id;
end;
$$;

revoke all on function public.approve_knowledge_candidate(uuid, boolean) from public;
grant execute on function public.approve_knowledge_candidate(uuid, boolean) to service_role;
