alter table users add column if not exists preferred_area text;

notify pgrst, 'reload schema';
