-- Trigram lookup for the ingredient resolver (T19).
--
-- Lives in the database rather than in application code so it can use the GIN
-- trigram index built in the initial migration; doing this in JS would mean
-- pulling every ingredient name over the wire on each miss.

create or replace function match_ingredient(query text, threshold real default 0.55)
returns table (id uuid, name text, score real)
language sql
stable
as $$
  select i.id, i.name::text, similarity(i.name::text, query) as score
  from ingredients i
  where similarity(i.name::text, query) >= threshold
  order by score desc, i.name
  limit 5;
$$;

-- Aliases are searched too: a new recipe saying "cilantro" should find the
-- coriander alias even when the canonical name is nothing like it.
create or replace function match_ingredient_alias(query text, threshold real default 0.55)
returns table (id uuid, name text, score real)
language sql
stable
as $$
  select i.id, i.name::text, similarity(a.alias::text, query) as score
  from ingredient_aliases a
  join ingredients i on i.id = a.ingredient_id
  where similarity(a.alias::text, query) >= threshold
  order by score desc
  limit 5;
$$;

grant execute on function match_ingredient(text, real) to authenticated;
grant execute on function match_ingredient_alias(text, real) to authenticated;
