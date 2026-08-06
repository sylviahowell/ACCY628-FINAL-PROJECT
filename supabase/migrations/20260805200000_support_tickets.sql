-- In-app support desk: tickets + threaded messages (UVdesk-inspired, native).
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  created_by uuid not null references public.profiles(id),
  customer_id uuid references public.customers(id),
  carrier_id uuid references public.carriers(id),
  subject text not null,
  category text not null default 'other'
    check (category in ('shipment', 'billing', 'account', 'other')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  status text not null default 'open'
    check (status in ('open', 'pending', 'resolved', 'closed')),
  shipment_id uuid references public.shipments(id),
  invoice_id uuid references public.invoices(id),
  assigned_to uuid references public.profiles(id),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_org_chk check (
    customer_id is not null or carrier_id is not null
  )
);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_customer_idx
  on public.support_tickets (customer_id);
create index if not exists support_tickets_carrier_idx
  on public.support_tickets (carrier_id);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

-- Staff: full access
drop policy if exists support_tickets_staff on public.support_tickets;
create policy support_tickets_staff on public.support_tickets
  for all
  using (
    public.current_role() = any (
      array['manager'::user_role, 'broker'::user_role, 'billing'::user_role]
    )
  )
  with check (
    public.current_role() = any (
      array['manager'::user_role, 'broker'::user_role, 'billing'::user_role]
    )
  );

-- Shipper: own org tickets; cannot set staff fields on insert
drop policy if exists support_tickets_customer_select on public.support_tickets;
create policy support_tickets_customer_select on public.support_tickets
  for select
  using (
    customer_id = (
      select profiles.customer_id from public.profiles where profiles.id = auth.uid()
    )
  );

drop policy if exists support_tickets_customer_insert on public.support_tickets;
create policy support_tickets_customer_insert on public.support_tickets
  for insert
  with check (
    public.current_role() = 'customer'::user_role
    and created_by = auth.uid()
    and customer_id = (
      select profiles.customer_id from public.profiles where profiles.id = auth.uid()
    )
    and carrier_id is null
    and assigned_to is null
    and resolved_by is null
    and resolved_at is null
  );

drop policy if exists support_tickets_customer_update on public.support_tickets;
create policy support_tickets_customer_update on public.support_tickets
  for update
  using (
    customer_id = (
      select profiles.customer_id from public.profiles where profiles.id = auth.uid()
    )
  )
  with check (
    customer_id = (
      select profiles.customer_id from public.profiles where profiles.id = auth.uid()
    )
  );

-- Carrier: own org tickets
drop policy if exists support_tickets_carrier_select on public.support_tickets;
create policy support_tickets_carrier_select on public.support_tickets
  for select
  using (
    carrier_id = (
      select profiles.carrier_id from public.profiles where profiles.id = auth.uid()
    )
  );

drop policy if exists support_tickets_carrier_insert on public.support_tickets;
create policy support_tickets_carrier_insert on public.support_tickets
  for insert
  with check (
    public.current_role() = 'carrier'::user_role
    and created_by = auth.uid()
    and carrier_id = (
      select profiles.carrier_id from public.profiles where profiles.id = auth.uid()
    )
    and customer_id is null
    and assigned_to is null
    and resolved_by is null
    and resolved_at is null
  );

drop policy if exists support_tickets_carrier_update on public.support_tickets;
create policy support_tickets_carrier_update on public.support_tickets
  for update
  using (
    carrier_id = (
      select profiles.carrier_id from public.profiles where profiles.id = auth.uid()
    )
  )
  with check (
    carrier_id = (
      select profiles.carrier_id from public.profiles where profiles.id = auth.uid()
    )
  );

-- Messages: staff all
drop policy if exists support_ticket_messages_staff on public.support_ticket_messages;
create policy support_ticket_messages_staff on public.support_ticket_messages
  for all
  using (
    public.current_role() = any (
      array['manager'::user_role, 'broker'::user_role, 'billing'::user_role]
    )
  )
  with check (
    public.current_role() = any (
      array['manager'::user_role, 'broker'::user_role, 'billing'::user_role]
    )
  );

-- Portal: non-internal messages on own tickets
drop policy if exists support_ticket_messages_portal_select on public.support_ticket_messages;
create policy support_ticket_messages_portal_select on public.support_ticket_messages
  for select
  using (
    is_internal = false
    and ticket_id in (
      select t.id
      from public.support_tickets t
      where t.customer_id = (
          select profiles.customer_id from public.profiles where profiles.id = auth.uid()
        )
         or t.carrier_id = (
          select profiles.carrier_id from public.profiles where profiles.id = auth.uid()
        )
    )
  );

drop policy if exists support_ticket_messages_portal_insert on public.support_ticket_messages;
create policy support_ticket_messages_portal_insert on public.support_ticket_messages
  for insert
  with check (
    author_id = auth.uid()
    and is_internal = false
    and public.current_role() = any (array['customer'::user_role, 'carrier'::user_role])
    and ticket_id in (
      select t.id
      from public.support_tickets t
      where t.customer_id = (
          select profiles.customer_id from public.profiles where profiles.id = auth.uid()
        )
         or t.carrier_id = (
          select profiles.carrier_id from public.profiles where profiles.id = auth.uid()
        )
    )
  );

grant select, insert, update, delete on public.support_tickets to authenticated;
grant select, insert, update, delete on public.support_ticket_messages to authenticated;
