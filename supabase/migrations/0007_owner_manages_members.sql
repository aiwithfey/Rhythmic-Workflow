-- Removing the invite panel left a gap: Google Console decides who can
-- authenticate, but nothing decided who becomes a team member. Someone who
-- signs in lands on "not on a team yet" and stays there. This gives the owner
-- the two controls that close it — approve a waiting sign-in, remove a member —
-- as security-definer functions rather than an edge function, so there is no
-- service-role key involved and nothing to deploy.

-- The account that runs the team holds the role the functions below check for.
update public.team_members tm
   set role = 'owner'
  from auth.users u
 where u.id = tm.user_id
   and lower(u.email) = 'feypelleg@gmail.com';

create or replace function public.is_team_owner()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.team_members
    where user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- Someone who has authenticated but joined no team. They are invisible to
-- `profiles_read` — not a teammate of anyone — so the owner needs a definer
-- function to see them at all. Email comes from auth.users because a derived
-- display name is not enough to recognise who is asking to be let in.
create or replace function public.pending_members()
returns table (id uuid, name text, email text, since timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.name, u.email, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
   where public.is_team_owner()
     and not exists (select 1 from public.team_members m where m.user_id = p.id)
   order by p.created_at desc;
$$;

create or replace function public.approve_member(p_user uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid;
begin
  if not public.is_team_owner() then
    raise exception 'not an owner';
  end if;

  select team_id into v_team
    from public.team_members
   where user_id = (select auth.uid())
   limit 1;

  insert into public.team_members (team_id, user_id, role)
  values (v_team, p_user, 'member')
  on conflict (team_id, user_id) do nothing;

  -- their invite row, if one was ever written, has done its job
  delete from public.invites i
   using auth.users u
   where u.id = p_user and lower(i.email) = lower(u.email);

  return 'joined';
end;
$$;

-- Removing someone keeps the team's work and drops only what was theirs alone.
-- Their tickets go back to unassigned — the board already renders an ownerless
-- ticket as "מחפשת מישהי" — while their private notes, which nobody else could
-- ever read, go with them.
create or replace function public.remove_member(p_user uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid;
begin
  if not public.is_team_owner() then
    raise exception 'not an owner';
  end if;

  -- An owner removing themselves would leave the team with no one who can
  -- approve anybody, and no way back in through the app.
  if p_user = (select auth.uid()) then
    raise exception 'an owner cannot remove themselves';
  end if;

  select team_id into v_team
    from public.team_members
   where user_id = (select auth.uid())
   limit 1;

  if not exists (
    select 1 from public.team_members
    where team_id = v_team and user_id = p_user
  ) then
    return 'not a member';
  end if;

  delete from public.tasks
   where owner_id = p_user and not ticket;

  update public.tasks
     set owner_id = null
   where owner_id = p_user and ticket and team_id = v_team;

  delete from public.team_members
   where team_id = v_team and user_id = p_user;

  return 'removed';
end;
$$;

revoke all on function public.is_team_owner()          from anon, public;
revoke all on function public.pending_members()        from anon, public;
revoke all on function public.approve_member(uuid)     from anon, public;
revoke all on function public.remove_member(uuid)      from anon, public;
grant execute on function public.is_team_owner()       to authenticated;
grant execute on function public.pending_members()     to authenticated;
grant execute on function public.approve_member(uuid)  to authenticated;
grant execute on function public.remove_member(uuid)   to authenticated;
