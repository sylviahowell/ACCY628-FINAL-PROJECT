-- Demo / production-shaped GPS positions for the shipment network map.
-- Today: seed + demo telemetry. Production: ELD/mobile writes the same columns.

create table if not exists public.vehicle_positions (
  shipment_id uuid primary key references public.shipments (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  speed_mph numeric(6, 2) not null default 60,
  heading_deg numeric(6, 2),
  source text not null default 'demo_seed',
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_positions_lat_check check (lat >= -90 and lat <= 90),
  constraint vehicle_positions_lng_check check (lng >= -180 and lng <= 180),
  constraint vehicle_positions_speed_check check (speed_mph >= 0 and speed_mph <= 120)
);

comment on table public.vehicle_positions is
  'Current vehicle lat/lng per shipment. Demo seed telemetry today; swap writers for real ELD later.';

create index if not exists vehicle_positions_recorded_at_idx
  on public.vehicle_positions (recorded_at desc);

alter table public.vehicle_positions enable row level security;

drop policy if exists vehicle_positions_staff_select on public.vehicle_positions;
create policy vehicle_positions_staff_select on public.vehicle_positions
  for select to authenticated
  using (
    public.current_role() = any (
      array['manager'::user_role, 'broker'::user_role, 'billing'::user_role]
    )
  );

drop policy if exists vehicle_positions_carrier_select on public.vehicle_positions;
create policy vehicle_positions_carrier_select on public.vehicle_positions
  for select to authenticated
  using (
    public.current_role() = 'carrier'::user_role
    and shipment_id in (
      select s.id from public.shipments s
      where s.carrier_id = (
        select p.carrier_id from public.profiles p where p.id = auth.uid()
      )
    )
  );

-- Staff may upsert demo telemetry (future device feeds can use service role).
drop policy if exists vehicle_positions_staff_write on public.vehicle_positions;
create policy vehicle_positions_staff_write on public.vehicle_positions
  for all to authenticated
  using (
    public.current_role() = any (array['manager'::user_role, 'broker'::user_role])
  )
  with check (
    public.current_role() = any (array['manager'::user_role, 'broker'::user_role])
  );

grant select, insert, update, delete on public.vehicle_positions to authenticated;
