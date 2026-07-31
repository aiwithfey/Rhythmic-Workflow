-- Being teamless was a dead end. The screen said "ask someone on the team" and
-- gave you nothing to press, while the owner's panel inferred who was waiting
-- from the absence of a membership row — which is not a request, only a
-- silence. Nobody could tell "signed in once by accident" from "please let me
-- in", and a person removed on purpose came straight back to the top of the
-- queue looking like a newcomer.
--
-- A request is now a thing someone makes, and a decision is a thing that
-- sticks.

create table if not exists public.join_requests (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  note       text not null default '',
  status     text not null default 'pending' check (status in ('pending', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);

create index if not exists join_requests_team_idx
  on public.join_requests (team_id, status, created_at desc);

alter table public.join_requests enable row level security;
revoke all on public.join_requests from anon;

-- You may see your own request whatever it says; the owner sees the ones
-- addressed to their team. Writes go through the functions below, never
-- straight at the table, so there is no insert or update policy at all.
drop policy if exists join_requests_read_own on public.join_requests;
create policy join_requests_read_own on public.join_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_owner());

-- ------------------------------------------------------- asking to join --

-- A teamless account cannot read public.teams — the policy there wants
-- membership, which is the thing being asked for. This is the one keyhole:
-- the name of a team you might join, and nothing else about it.
create or replace function public.joinable_teams()
returns table (id uuid, name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id, t.name
    from public.teams t
   where (select auth.uid()) is not null
     and not exists (
       select 1 from public.team_members m
        where m.user_id = (select auth.uid())
     )
   order by t.name;
$$;

-- Re-asking after a decline is allowed: the row goes back to pending and the
-- owner decides again. For a team this size a nuisance is easier to absorb
-- than a person who is locked out with no way to say so.
create or replace function public.request_to_join(p_team uuid, p_note text default '')
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  if exists (select 1 from public.team_members m where m.user_id = uid) then
    return 'already a member';
  end if;

  if not exists (select 1 from public.teams t where t.id = p_team) then
    raise exception 'no such team';
  end if;

  insert into public.join_requests (user_id, team_id, note, status)
  values (uid, p_team, left(coalesce(p_note, ''), 280), 'pending')
  on conflict (user_id) do update
    set team_id    = excluded.team_id,
        note       = excluded.note,
        status     = 'pending',
        created_at = now(),
        decided_at = null,
        decided_by = null;

  return 'requested';
end;
$$;

-- The waiting screen asks this to know whether it is showing a form or a
-- receipt, so it has to answer for a caller with no team.
create or replace function public.my_join_request()
returns table (team_id uuid, team_name text, status text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.team_id, t.name, r.status, r.created_at
    from public.join_requests r
    join public.teams t on t.id = r.team_id
   where r.user_id = (select auth.uid());
$$;

-- ------------------------------------------------------ deciding on it --

-- Everyone who has signed in and is not on the team, carrying whether they
-- actually asked and what they said. Declined requests drop out, which is what
-- finally gives the owner a way to clear someone who should not be there —
-- including a person they just removed, who until now reappeared here
-- instantly as if they were new.
drop function if exists public.pending_members();
create function public.pending_members()
returns table (
  id        uuid,
  name      text,
  email     text,
  since     timestamptz,
  requested boolean,
  note      text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id,
         p.name,
         u.email,
         coalesce(r.created_at, p.created_at),
         r.user_id is not null,
         coalesce(r.note, '')
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.join_requests r
           on r.user_id = p.id and r.status = 'pending'
   where public.is_team_owner()
     and not exists (select 1 from public.team_members m where m.user_id = p.id)
     and not exists (
       select 1 from public.join_requests d
        where d.user_id = p.id and d.status = 'declined'
     )
   order by (r.user_id is not null) desc, coalesce(r.created_at, p.created_at) desc;
$$;

create or replace function public.decline_request(p_user uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid;
begin
  if not public.is_team_owner() then
    raise exception 'not an owner';
  end if;

  select m.team_id into v_team
    from public.team_members m
   where m.user_id = (select auth.uid())
   limit 1;

  -- Someone who never asked still needs to be dismissable, so this writes a
  -- declined row rather than only updating one that exists.
  insert into public.join_requests (user_id, team_id, status, decided_at, decided_by)
  values (p_user, v_team, 'declined', now(), (select auth.uid()))
  on conflict (user_id) do update
    set status     = 'declined',
        decided_at = now(),
        decided_by = (select auth.uid());

  return 'declined';
end;
$$;

-- Approving consumes the request along with the invite it might have had.
create or replace function public.approve_member(p_user uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid;
begin
  if not public.is_team_owner() then
    raise exception 'not an owner';
  end if;

  select m.team_id into v_team
    from public.team_members m
   where m.user_id = (select auth.uid())
   limit 1;

  if v_team is null then
    raise exception 'owner is not on a team';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_team, p_user, 'member')
  on conflict (team_id, user_id) do nothing;

  delete from public.join_requests where user_id = p_user;
  delete from public.invites
   where lower(email) = (select lower(u.email) from auth.users u where u.id = p_user);

  return 'approved';
end;
$$;

-- Removing someone clears their request history too, so if they come back and
-- ask again it reads as a fresh request rather than a stale decision.
create or replace function public.remove_member(p_user uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid;
begin
  if not public.is_team_owner() then
    raise exception 'not an owner';
  end if;

  if p_user = (select auth.uid()) then
    raise exception 'cannot remove yourself';
  end if;

  select m.team_id into v_team
    from public.team_members m
   where m.user_id = (select auth.uid())
   limit 1;

  if not exists (
    select 1 from public.team_members m
     where m.user_id = p_user and m.team_id = v_team
  ) then
    return 'not a member';
  end if;

  -- Nobody else could ever read these, so they leave with the person.
  delete from public.tasks
   where owner_id = p_user and not ticket and team_id = v_team;

  -- The work itself stays, waiting for someone to claim it.
  update public.tasks
     set owner_id = null
   where owner_id = p_user and ticket and team_id = v_team;

  delete from public.team_members
   where user_id = p_user and team_id = v_team;

  delete from public.join_requests where user_id = p_user;

  return 'removed';
end;
$$;

revoke all on function public.joinable_teams()          from anon, public;
revoke all on function public.request_to_join(uuid,text) from anon, public;
revoke all on function public.my_join_request()         from anon, public;
revoke all on function public.decline_request(uuid)     from anon, public;
grant execute on function public.joinable_teams()          to authenticated;
grant execute on function public.request_to_join(uuid,text) to authenticated;
grant execute on function public.my_join_request()         to authenticated;
grant execute on function public.decline_request(uuid)     to authenticated;
grant execute on function public.pending_members()         to authenticated;

-- So a request lands in the owner's open panel instead of waiting for a reload.
do $$
begin
  alter publication supabase_realtime add table public.join_requests;
exception when duplicate_object then null;
end $$;
