create table if not exists support_tickets (
  id bigint generated always as identity primary key,
  ticket_no text not null unique,
  user_id bigint references users(id),
  order_id bigint references orders(id),
  type text not null default 'general',
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  title text,
  message text not null,
  phone text,
  image_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_user_id_idx on support_tickets(user_id);
create index if not exists support_tickets_order_id_idx on support_tickets(order_id);
create index if not exists support_tickets_status_idx on support_tickets(status);
