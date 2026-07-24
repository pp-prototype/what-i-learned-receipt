create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_limit constant integer := 50;
  owned_project_count integer;
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'Project owner must match the authenticated user'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));

  select count(*)
    into owned_project_count
    from public.projects
    where owner_id = new.owner_id;

  if owned_project_count >= project_limit then
    raise exception 'Project limit reached'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_project_limit() from public, anon, authenticated;

drop trigger if exists enforce_project_limit_before_insert on public.projects;
create trigger enforce_project_limit_before_insert
  before insert on public.projects
  for each row execute function public.enforce_project_limit();
