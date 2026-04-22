create table if not exists users (
  id bigint generated always as identity primary key,
  line_user_id text unique,
  role text not null default 'customer' check (role in ('customer', 'technician', 'admin')),
  name text,
  phone text,
  line_display_name text,
  line_picture_url text,
  line_language text,
  default_address text,
  preferred_area text,
  is_member boolean not null default false,
  member_terms_accepted_at timestamptz,
  available_time_text text,
  trust_score numeric not null default 0,
  status text not null default 'active',
  available boolean not null default false,
  service_areas text[] not null default '{}',
  service_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id bigint generated always as identity primary key,
  order_no text not null unique,
  customer_id bigint references users(id),
  technician_id bigint references users(id),
  service_type text not null,
  area text not null,
  address text not null,
  issue_description text not null,
  contact_name text,
  contact_phone text,
  service_mode text not null default 'urgent' check (service_mode in ('urgent', 'scheduled')),
  preferred_time_text text,
  status text not null,
  quote_amount integer,
  estimated_arrival_time text,
  final_amount integer,
  priority_score integer not null default 0,
  risk_score integer not null default 0,
  cancelled_by text,
  cancel_reason_code text,
  cancel_reason_text text,
  dispute_reason text,
  platform_review_reason text,
  change_request_amount integer,
  change_request_reason text,
  change_request_status text check (change_request_status in ('pending', 'approved', 'rejected')),
  completion_summary text,
  paid_amount integer,
  rating integer,
  customer_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assignments (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id),
  technician_id bigint references users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, technician_id)
);

create table if not exists order_messages (
  id bigint generated always as identity primary key,
  order_id bigint references orders(id),
  sender_role text not null,
  sender_id bigint,
  message_type text not null default 'text',
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists order_images (
  id bigint generated always as identity primary key,
  order_id bigint references orders(id),
  image_url text not null,
  category text not null check (category in ('issue', 'quote', 'completion', 'change_request')),
  created_at timestamptz not null default now()
);

create table if not exists order_logs (
  id bigint generated always as identity primary key,
  order_id bigint references orders(id),
  from_status text,
  to_status text,
  action text not null,
  operator_role text not null,
  operator_id bigint,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists customer_sessions (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade unique,
  flow_type text,
  current_step text,
  temp_payload jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

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
  admin_reply text,
  admin_replied_at timestamptz,
  admin_replied_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_user_id_idx on support_tickets(user_id);
create index if not exists support_tickets_order_id_idx on support_tickets(order_id);
create index if not exists support_tickets_status_idx on support_tickets(status);
create index if not exists support_tickets_type_idx on support_tickets(type);
