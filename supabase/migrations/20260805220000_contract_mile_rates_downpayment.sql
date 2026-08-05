-- Contract mile rates + customer downpayment for brokerage pricing demos.
alter table public.contracts
  add column if not exists downpayment_pct numeric(5,2) not null default 20,
  add column if not exists customer_rate_per_mile numeric(10,4),
  add column if not exists carrier_rate_per_mile numeric(10,4);

comment on column public.contracts.downpayment_pct is
  'Percent of customer line (rate + fuel) due as downpayment at booking';
comment on column public.contracts.customer_rate_per_mile is
  'Customer bill rate per mile when using mile-based pricing';
comment on column public.contracts.carrier_rate_per_mile is
  'Carrier pay rate per mile when using mile-based pricing';

update public.contracts
set
  downpayment_pct = coalesce(downpayment_pct, 20),
  customer_rate_per_mile = coalesce(customer_rate_per_mile, 3.50),
  carrier_rate_per_mile = coalesce(carrier_rate_per_mile, 2.75)
where customer_rate_per_mile is null
   or carrier_rate_per_mile is null;
