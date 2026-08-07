-- Write access to the recipe-images bucket.
--
-- Making a bucket public grants public READ only; storage.objects still applies
-- RLS to writes, and with no policy the app's session-authenticated upload is
-- rejected with "new row violates row-level security policy". Image generation
-- succeeds and then fails at the last step, which is a confusing place to land.
--
-- Scoped to this one bucket and to authenticated sessions, matching the rest of
-- the schema: the household allowlist decides who is authenticated, and anyone
-- authenticated may manage recipe imagery.

create policy "authenticated can upload recipe images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recipe-images');

-- Regenerating an image upserts over the existing object, which is an update.
create policy "authenticated can replace recipe images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recipe-images')
  with check (bucket_id = 'recipe-images');

create policy "authenticated can remove recipe images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recipe-images');

-- Reads are already public via the bucket flag; this makes the intent explicit
-- and keeps the app working if the bucket is ever flipped to private.
create policy "authenticated can read recipe images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'recipe-images');
