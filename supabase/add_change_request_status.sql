alter table orders
add column if not exists change_request_status text
check (change_request_status in ('pending', 'approved', 'rejected'));
