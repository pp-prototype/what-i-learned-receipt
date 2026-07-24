create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  subtitle text check (subtitle is null or char_length(subtitle) <= 120),
  note text not null check (char_length(note) between 1 and 2000),
  learning_date date not null,
  image_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists receipts_owner_created_idx
  on public.receipts(owner_id, created_at desc);

create index if not exists receipts_project_created_idx
  on public.receipts(project_id, created_at desc);

alter table public.receipts enable row level security;

revoke all on table public.receipts from anon, authenticated;
grant select, insert, delete on table public.receipts to authenticated;

drop policy if exists "Users can view their own receipts" on public.receipts;
create policy "Users can view their own receipts"
  on public.receipts
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Users can create their own receipts" on public.receipts;
create policy "Users can create their own receipts"
  on public.receipts
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete their own receipts" on public.receipts;
create policy "Users can delete their own receipts"
  on public.receipts
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.enforce_receipt_constraints()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_limit constant integer := 100;
  owned_receipt_count integer;
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'Receipt owner must match the authenticated user'
      using errcode = '42501';
  end if;

  if new.image_path not like new.owner_id::text || '/%' then
    raise exception 'Receipt image path must be inside the user folder'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = new.project_id
      and owner_id = new.owner_id
  ) then
    raise exception 'Receipt project must belong to the authenticated user'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 1));

  select count(*)
    into owned_receipt_count
    from public.receipts
    where owner_id = new.owner_id;

  if owned_receipt_count >= receipt_limit then
    raise exception 'Receipt limit reached'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_receipt_constraints() from public, anon, authenticated;

drop trigger if exists enforce_receipt_constraints_before_insert on public.receipts;
create trigger enforce_receipt_constraints_before_insert
  before insert on public.receipts
  for each row execute function public.enforce_receipt_constraints();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/png'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_upload_receipt_image(object_name text)
returns boolean
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  stored_image_count integer;
begin
  if current_user_id is null
    or object_name not like current_user_id::text || '/%'
  then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 2));

  select count(*)
    into stored_image_count
    from storage.objects
    where bucket_id = 'receipts'
      and (storage.foldername(name))[1] = current_user_id::text;

  return stored_image_count < 100;
end;
$$;

revoke all on function public.can_upload_receipt_image(text) from public, anon;
grant execute on function public.can_upload_receipt_image(text) to authenticated;

drop policy if exists "Users can view their own receipt images" on storage.objects;
create policy "Users can view their own receipt images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can upload their own receipt images" on storage.objects;
create policy "Users can upload their own receipt images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_upload_receipt_image(name)
  );

drop policy if exists "Users can delete their own receipt images" on storage.objects;
create policy "Users can delete their own receipt images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
