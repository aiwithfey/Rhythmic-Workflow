-- Deleting a member sets tasks.owner_id to null, which a private task cannot
-- survive: it needs an owner and a day. Without this, removing a person from
-- the app fails outright on the check constraint.
--
-- Nobody but the owner could ever read those notes, so they go with the
-- account, while published tickets stay behind as unassigned work.
create or replace function public.drop_private_tasks_with_owner()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.tasks where owner_id = old.id and not ticket;
  return old;
end;
$$;

drop trigger if exists profiles_drop_private_tasks on public.profiles;
create trigger profiles_drop_private_tasks before delete on public.profiles
  for each row execute function public.drop_private_tasks_with_owner();
