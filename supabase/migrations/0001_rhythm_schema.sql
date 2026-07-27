-- Rhythmic Workflow — initial schema.
--
-- The privacy rule of this product cannot live in the client. `ticket` is the
-- difference between a note only I can see and a card the team works from, so
-- it is enforced here, in row level security, and the client is free to be
-- wrong about it.

-- ---------------------------------------------------------------- identity --

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  initials   text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Closed team: you get in because someone already on it left your address here.
create table if not exists public.invites (
  email      text primary key,
  team_id    uuid not null references public.teams(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ rhythm --

-- The team sees which energy a day holds...
create table if not exists public.day_marks (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  type       text not null check (type in ('open', 'surge', 'connection', 'rest')),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ...and nobody sees what you wrote in it. Row level security cannot hide a
-- single column, so the note lives in its own table rather than next to the
-- energy the team is allowed to read.
create table if not exists public.day_notes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  note       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ------------------------------------------------------------------- tasks --

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  owner_id     uuid references public.profiles(id) on delete set null,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  text         text not null check (length(btrim(text)) > 0),
  done         boolean not null default false,
  ticket       boolean not null default false,
  status       text not null default 'backlog' check (status in ('backlog', 'planned', 'doing', 'done')),
  day          date,
  energy       text not null default 'open' check (energy in ('open', 'surge', 'connection')),
  blocked      boolean not null default false,
  blocked_note text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A private task is found by its day. One without a day belongs to no view
  -- at all, so the database refuses to hold one.
  constraint private_task_needs_a_day
    check (ticket or (owner_id is not null and day is not null))
);

create table if not exists public.task_updates (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  text       text not null check (length(btrim(text)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists tasks_team_status_idx on public.tasks (team_id, status);
create index if not exists tasks_owner_day_idx   on public.tasks (owner_id, day);
create index if not exists task_updates_task_idx on public.task_updates (task_id, created_at);
create index if not exists day_marks_day_idx     on public.day_marks (day);

-- --------------------------------------------------------------- functions --

-- Membership lookups used inside policies must not re-enter the policies that
-- call them, so they run as definer.
create or replace function public.is_team_member(t uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.team_members
    where team_id = t and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_teammate(target uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.team_members mine
    join public.team_members theirs on theirs.team_id = mine.team_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

drop trigger if exists day_marks_touch on public.day_marks;
create trigger day_marks_touch before update on public.day_marks
  for each row execute function public.touch_updated_at();

drop trigger if exists day_notes_touch on public.day_notes;
create trigger day_notes_touch before update on public.day_notes
  for each row execute function public.touch_updated_at();

-- A new sign-in becomes a profile, and joins the team that invited it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  display text;
  inv     public.invites%rowtype;
begin
  display := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, name, initials)
  values (new.id, display, left(display, 2))
  on conflict (id) do nothing;

  select * into inv from public.invites where lower(email) = lower(new.email);
  if found then
    insert into public.team_members (team_id, user_id, role)
    values (inv.team_id, new.id, inv.role)
    on conflict do nothing;
    delete from public.invites where lower(email) = lower(new.email);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------- rls --

alter table public.profiles     enable row level security;
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.invites      enable row level security;
alter table public.day_marks    enable row level security;
alter table public.day_notes    enable row level security;
alter table public.tasks        enable row level security;
alter table public.task_updates enable row level security;

-- profiles: my teammates are people, not ids
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_teammate(id));

drop policy if exists profiles_write_self on public.profiles;
create policy profiles_write_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

-- teams and membership
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select to authenticated
  using (public.is_team_member(id));

drop policy if exists team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists invites_read on public.invites;
create policy invites_read on public.invites for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists invites_write on public.invites;
create policy invites_write on public.invites for insert to authenticated
  with check (public.is_team_member(team_id) and invited_by = (select auth.uid()));

drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites for delete to authenticated
  using (public.is_team_member(team_id));

-- day energy: shared with the team. day notes: never.
drop policy if exists day_marks_read on public.day_marks;
create policy day_marks_read on public.day_marks for select to authenticated
  using (user_id = (select auth.uid()) or public.is_teammate(user_id));

drop policy if exists day_marks_write on public.day_marks;
create policy day_marks_write on public.day_marks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists day_notes_own on public.day_notes;
create policy day_notes_own on public.day_notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- tasks: mine always, everyone else's only once published
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
  using (
    owner_id = (select auth.uid())
    or created_by = (select auth.uid())
    or (ticket and public.is_team_member(team_id))
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_team_member(team_id));

-- Teammates may work a published card — move it, claim it, comment on it. The
-- with-check is what stops them taking it private: unpublishing leaves a row
-- that is neither theirs nor a ticket, which no longer satisfies the policy.
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    owner_id = (select auth.uid())
    or created_by = (select auth.uid())
    or (ticket and public.is_team_member(team_id))
  )
  with check (
    owner_id = (select auth.uid())
    or created_by = (select auth.uid())
    or (ticket and public.is_team_member(team_id))
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (owner_id = (select auth.uid()) or created_by = (select auth.uid()));

-- updates inherit whatever the task allows
drop policy if exists task_updates_read on public.task_updates;
create policy task_updates_read on public.task_updates for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

drop policy if exists task_updates_insert on public.task_updates;
create policy task_updates_insert on public.task_updates for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id)
  );

drop policy if exists task_updates_delete on public.task_updates;
create policy task_updates_delete on public.task_updates for delete to authenticated
  using (author_id = (select auth.uid()));

-- --------------------------------------------------------------- realtime --

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.task_updates;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.day_marks;
exception when duplicate_object then null;
end $$;
