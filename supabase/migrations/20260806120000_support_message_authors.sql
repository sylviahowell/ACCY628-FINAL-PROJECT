-- Denormalize message author display for portal-readable threads.
alter table public.support_ticket_messages
  add column if not exists author_display_name text,
  add column if not exists author_role text;

update public.support_ticket_messages m
set
  author_display_name = coalesce(p.full_name, 'RowanLane Support'),
  author_role = coalesce(p.role::text, 'staff')
from public.profiles p
where p.id = m.author_id
  and (m.author_display_name is null or m.author_role is null);

update public.support_ticket_messages
set author_display_name = coalesce(author_display_name, 'RowanLane Support')
where author_display_name is null;

alter table public.support_ticket_messages
  alter column author_display_name set not null;
