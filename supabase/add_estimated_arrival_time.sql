alter table orders add column if not exists estimated_arrival_time text;

notify pgrst, 'reload schema';
