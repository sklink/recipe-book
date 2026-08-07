-- AI usage log.
--
-- Two jobs: cost visibility (T28), and enforcing a per-day cap so a runaway
-- loop can't quietly run up a bill. Every call is recorded whether it succeeded
-- or not — a failing call still costs tokens.

create type ai_generation_kind as enum ('recipe', 'variant', 'image', 'import');

create table ai_generations (
  id            uuid primary key default gen_random_uuid(),
  kind          ai_generation_kind not null,
  model         text not null,
  recipe_id     uuid references recipes (id) on delete set null,
  input_tokens  integer,
  output_tokens integer,
  -- Tenths of a cent: image models are priced well below a cent per call, so
  -- whole cents would round most rows to zero.
  cost_millicents integer,
  duration_ms   integer,
  error         text,
  created_at    timestamptz not null default now()
);

create index ai_generations_created_idx on ai_generations (created_at desc);
create index ai_generations_kind_idx on ai_generations (kind, created_at desc);

alter table ai_generations enable row level security;

create policy "authenticated full access" on ai_generations
  for all to authenticated using (true) with check (true);
