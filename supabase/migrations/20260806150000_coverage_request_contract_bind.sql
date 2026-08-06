-- Bind coverage requests to contracts with quoted rate snapshots.

alter table public.coverage_requests
  add column if not exists contract_id uuid references public.contracts(id),
  add column if not exists miles numeric,
  add column if not exists quoted_customer_rate numeric,
  add column if not exists quoted_carrier_cost numeric;

create index if not exists coverage_requests_contract_idx
  on public.coverage_requests(contract_id)
  where contract_id is not null;

create index if not exists coverage_requests_customer_pending_idx
  on public.coverage_requests(customer_id, status)
  where status = 'pending';

comment on column public.coverage_requests.contract_id is
  'Active contract the shipper selected when requesting coverage.';
comment on column public.coverage_requests.miles is
  'Lane miles used for $/mi quote at request time.';
comment on column public.coverage_requests.quoted_customer_rate is
  'Customer line-haul snapshot from contract terms at request time.';
comment on column public.coverage_requests.quoted_carrier_cost is
  'Carrier pay snapshot from contract terms at request time.';
