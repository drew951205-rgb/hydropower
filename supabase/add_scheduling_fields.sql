alter table users
add column if not exists available_time_text text;

alter table orders
add column if not exists service_mode text
default 'urgent'
check (service_mode in ('urgent', 'scheduled'));

alter table orders
add column if not exists preferred_time_text text;

notify pgrst, 'reload schema';
