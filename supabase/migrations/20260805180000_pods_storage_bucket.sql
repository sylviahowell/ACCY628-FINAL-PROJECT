-- Optional: Supabase Storage bucket for proof-of-delivery files.
-- Apply in Studio SQL editor if you want cloud storage instead of local public/pod-uploads.
-- Local demo uploads work without this migration.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pods',
  'pods',
  true,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload pods" on storage.objects;
create policy "Authenticated users can upload pods"
on storage.objects for insert to authenticated
with check (bucket_id = 'pods');

drop policy if exists "Authenticated users can read pods" on storage.objects;
create policy "Authenticated users can read pods"
on storage.objects for select to authenticated
using (bucket_id = 'pods');

drop policy if exists "Public can read pods" on storage.objects;
create policy "Public can read pods"
on storage.objects for select to public
using (bucket_id = 'pods');

drop policy if exists "Authenticated users can update pods" on storage.objects;
create policy "Authenticated users can update pods"
on storage.objects for update to authenticated
using (bucket_id = 'pods')
with check (bucket_id = 'pods');
