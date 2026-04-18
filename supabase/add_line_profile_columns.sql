alter table users add column if not exists line_display_name text;
alter table users add column if not exists line_picture_url text;
alter table users add column if not exists line_language text;
alter table users add column if not exists default_address text;

notify pgrst, 'reload schema';
