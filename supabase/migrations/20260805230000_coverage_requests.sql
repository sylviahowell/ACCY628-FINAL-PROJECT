-- Customer coverage / carrier requests that brokers convert into loads.
create table if not exists public.coverage_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  requested_by uuid references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  pickup_location text not null,
  delivery_location text not null,
  pickup_date date,
  delivery_date date,
  freight_type text,
  weight_lbs numeric,
  notes text,
  shipment_id uuid references public.shipments(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists coverage_requests_status_idx
  on public.coverage_requests(status, created_at desc);
create index if not exists coverage_requests_customer_idx
  on public.coverage_requests(customer_id);

alter table public.coverage_requests enable row level security;

drop policy if exists coverage_requests_select on public.coverage_requests;
create policy coverage_requests_select on public.coverage_requests
  for select to authenticated using (true);

drop policy if exists coverage_requests_insert on public.coverage_requests;
create policy coverage_requests_insert on public.coverage_requests
  for insert to authenticated with check (true);

drop policy if exists coverage_requests_update on public.coverage_requests;
create policy coverage_requests_update on public.coverage_requests
  for update to authenticated using (true);
