alter table users add column if not exists is_member boolean not null default false;
alter table users add column if not exists member_terms_accepted_at timestamptz;

notify pgrst, 'reload schema';
