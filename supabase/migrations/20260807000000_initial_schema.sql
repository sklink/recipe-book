-- Recipe Book — initial schema
-- See docs/PLAN.md §2 for the reasoning behind these choices.

create extension if not exists "citext";      -- case-insensitive ingredient names
create extension if not exists "pg_trgm";     -- fuzzy ingredient matching (T19)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type meal_type      as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type image_status   as enum ('pending', 'ready', 'failed');
create type recipe_source  as enum ('manual', 'ai', 'imported');
create type cook_outcome   as enum ('flopped', 'rough', 'good', 'nailed');
create type mastery_level  as enum ('untried', 'attempted', 'learning', 'reliable', 'mastered');

-- ---------------------------------------------------------------------------
-- Ingredients
-- ---------------------------------------------------------------------------

create table ingredients (
  id         uuid primary key default gen_random_uuid(),
  name       citext not null unique,
  category   text not null default 'other',
  -- Manual flag, not a heuristic: where the staple line falls is personal.
  is_staple  boolean not null default false,
  created_at timestamptz not null default now()
);

-- Alternate names that resolve to a canonical ingredient ("scallion" -> "spring onion").
create table ingredient_aliases (
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  alias         citext not null unique,
  created_at    timestamptz not null default now()
);

create table ingredient_stock (
  ingredient_id uuid primary key references ingredients (id) on delete cascade,
  in_stock      boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

create table recipes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  -- Array, not a single enum: a frittata is legitimately breakfast AND lunch.
  meal_types   meal_type[] not null default '{}',
  -- Stored in minutes; Quick/Average/Commitment buckets are derived in app code
  -- so the thresholds stay tunable in one place.
  time_minutes integer not null check (time_minutes > 0),
  servings     integer check (servings > 0),
  -- Ordered steps: [{ "step": 1, "text": "..." }, ...]
  instructions jsonb not null default '[]'::jsonb,

  image_url    text,
  image_status image_status not null default 'pending',

  source       recipe_source not null default 'manual',
  source_url   text,

  -- Null = base recipe. Non-null = variant of that recipe.
  parent_recipe_id uuid references recipes (id) on delete cascade,
  variant_note     text,

  is_favourite     boolean not null default false,
  -- Escape hatch: mastery is normally derived from cook_logs, but you know
  -- whether you can actually make a thing better than a row count does.
  mastery_override mastery_level,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A recipe cannot be its own parent.
  constraint recipes_parent_not_self check (parent_recipe_id is null or parent_recipe_id <> id)
);

create table recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  amount        numeric,
  unit          text,
  prep_note     text,        -- "finely chopped", "at room temperature"
  is_optional   boolean not null default false,
  sort_order    integer not null default 0,

  unique (recipe_id, ingredient_id)
);

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------

create table cart_items (
  id                uuid primary key default gen_random_uuid(),
  ingredient_id     uuid not null unique references ingredients (id) on delete cascade,
  -- Free text on purpose: aggregating "2 tbsp" + "1 cup" needs a unit-conversion
  -- engine that is out of scope for v1. Shows as "2 tbsp + 1 cup".
  amount_note       text,
  source_recipe_ids uuid[] not null default '{}',
  is_checked        boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cook log (mastery is derived from this, never stored)
-- ---------------------------------------------------------------------------

create table cook_logs (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes (id) on delete cascade,
  cooked_at  timestamptz not null default now(),
  outcome    cook_outcome not null,
  notes      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index recipes_meal_types_idx   on recipes using gin (meal_types);
create index recipes_time_minutes_idx on recipes (time_minutes);
create index recipes_parent_idx       on recipes (parent_recipe_id) where parent_recipe_id is not null;

create index recipe_ingredients_recipe_idx     on recipe_ingredients (recipe_id);
create index recipe_ingredients_ingredient_idx on recipe_ingredients (ingredient_id);

-- Trigram indexes back the fuzzy fallback in the T19 ingredient resolver.
create index ingredients_name_trgm_idx       on ingredients using gin (name gin_trgm_ops);
create index ingredient_aliases_trgm_idx     on ingredient_aliases using gin (alias gin_trgm_ops);
create index ingredient_aliases_ingredient_idx on ingredient_aliases (ingredient_id);

create index cook_logs_recipe_cooked_idx on cook_logs (recipe_id, cooked_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
  before update on recipes
  for each row execute function set_updated_at();

create trigger ingredient_stock_set_updated_at
  before update on ingredient_stock
  for each row execute function set_updated_at();

-- Every ingredient gets a stock row (defaulting to out of stock) so the
-- ingredients page never has to left-join around missing rows.
create or replace function create_ingredient_stock_row()
returns trigger
language plpgsql
as $$
begin
  insert into ingredient_stock (ingredient_id) values (new.id)
  on conflict (ingredient_id) do nothing;
  return new;
end;
$$;

create trigger ingredients_create_stock_row
  after insert on ingredients
  for each row execute function create_ingredient_stock_row();

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Single-user app behind a login: any authenticated session gets full access,
-- anonymous sessions get nothing. If this ever becomes multi-tenant, these
-- policies are the seam to change.
-- ---------------------------------------------------------------------------

alter table ingredients         enable row level security;
alter table ingredient_aliases  enable row level security;
alter table ingredient_stock    enable row level security;
alter table recipes             enable row level security;
alter table recipe_ingredients  enable row level security;
alter table cart_items          enable row level security;
alter table cook_logs           enable row level security;

create policy "authenticated full access" on ingredients
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on ingredient_aliases
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on ingredient_stock
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on recipes
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on recipe_ingredients
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on cart_items
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on cook_logs
  for all to authenticated using (true) with check (true);
