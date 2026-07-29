-- Two things the board could not answer.
--
-- A ticket only had a title, so everything worth knowing ended up crammed into
-- it and the board became unreadable. Notes hold the detail; the title stays a
-- name. These are not the team update feed — an update says what changed, a
-- note says what the work is.
alter table public.tasks
  add column if not exists notes text not null default '';

-- And nothing recorded *when* a ticket was finished, so completed work could
-- not be ordered or filtered by date. updated_at moves for any edit, which
-- makes it the wrong answer to "what did we finish in March".
alter table public.tasks
  add column if not exists completed_at timestamptz;

create or replace function public.stamp_completed_at()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.completed_at := now();
  elsif not new.done then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_stamp_completed on public.tasks;
create trigger tasks_stamp_completed before insert or update on public.tasks
  for each row execute function public.stamp_completed_at();

-- Anything already finished gets its last edit as a best guess, so the archive
-- is not empty for work that predates this column.
update public.tasks
   set completed_at = updated_at
 where done and completed_at is null;

-- the archive reads newest-first within a team
create index if not exists tasks_completed_idx
  on public.tasks (team_id, completed_at desc)
  where done;
