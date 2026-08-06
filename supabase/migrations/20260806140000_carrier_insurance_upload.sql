-- Carrier self-serve insurance certificate URL + update RPC (column-safe under RLS).

alter table public.carriers
  add column if not exists insurance_certificate_url text;

comment on column public.carriers.insurance_certificate_url is
  'URL of the latest uploaded COI / insurance certificate (storage or local path).';

create or replace function public.update_own_carrier_insurance(
  p_expiration date,
  p_certificate_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  select carrier_id into cid
  from public.profiles
  where id = auth.uid();

  if cid is null then
    raise exception 'No carrier is linked to this account.';
  end if;

  if p_expiration is null then
    raise exception 'Insurance expiration date is required.';
  end if;

  update public.carriers
  set
    insurance_expiration = p_expiration,
    insurance_certificate_url = coalesce(p_certificate_url, insurance_certificate_url)
  where id = cid;
end;
$$;

revoke all on function public.update_own_carrier_insurance(date, text) from public;
grant execute on function public.update_own_carrier_insurance(date, text) to authenticated;

-- Optional storage bucket for insurance certificates (mirrors pods pattern).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'insurance',
  'insurance',
  true,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload insurance" on storage.objects;
create policy "Authenticated users can upload insurance"
on storage.objects for insert to authenticated
with check (bucket_id = 'insurance');

drop policy if exists "Authenticated users can read insurance" on storage.objects;
create policy "Authenticated users can read insurance"
on storage.objects for select to authenticated
using (bucket_id = 'insurance');

drop policy if exists "Public can read insurance" on storage.objects;
create policy "Public can read insurance"
on storage.objects for select to public
using (bucket_id = 'insurance');

drop policy if exists "Authenticated users can update insurance" on storage.objects;
create policy "Authenticated users can update insurance"
on storage.objects for update to authenticated
using (bucket_id = 'insurance')
with check (bucket_id = 'insurance');
