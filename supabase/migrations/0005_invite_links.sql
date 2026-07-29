-- Onboarding by email costs two messages — an invite and a login code — and the
-- built-in sender allows two an hour, so adding a few people at once is not
-- possible. A share link removes the first message: send it over WhatsApp, and
-- the only email left is the one that proves who they are.

create table if not exists public.invite_links (
  token      text primary key,
  team_id    uuid not null references public.teams(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  label      text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz,
  used_by    uuid references public.profiles(id) on delete set null
);

create index if not exists invite_links_team_idx on public.invite_links (team_id, created_at desc);

alter table public.invite_links enable row level security;

-- The token is the secret. Nobody reads this table to redeem one — that goes
-- through the function below — so the table itself is visible only to the team
-- that owns the links, and never to anon.
drop policy if exists invite_links_read on public.invite_links;
create policy invite_links_read on public.invite_links for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists invite_links_delete on public.invite_links;
create policy invite_links_delete on public.invite_links for delete to authenticated
  using (public.is_team_member(team_id));

revoke all on public.invite_links from anon;

-- Minting happens server-side so the token cannot be chosen by the caller.
-- gen_random_uuid is core Postgres, so this needs no extension: 122 bits of
-- randomness, hex, no separators to mangle in a URL.
create or replace function public.create_invite_link(p_label text default '', p_days int default 7)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_token text;
  v_team  uuid;
begin
  select team_id into v_team
    from public.team_members
   where user_id = (select auth.uid())
   limit 1;

  if v_team is null then
    raise exception 'not a member of any team';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.invite_links (token, team_id, label, created_by, expires_at)
  values (
    v_token,
    v_team,
    left(coalesce(p_label, ''), 60),
    (select auth.uid()),
    now() + make_interval(days => greatest(1, least(30, coalesce(p_days, 7))))
  );

  return v_token;
end;
$$;

-- Redemption claims the row and the membership together. The update is the
-- lock: exactly one caller can move used_at off null, so a shared link cannot
-- admit two people however fast they both click.
create or replace function public.redeem_invite_link(p_token text)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inv public.invite_links%rowtype;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    return 'unauthenticated';
  end if;

  update public.invite_links
     set used_at = now(), used_by = uid
   where token = p_token
     and used_at is null
     and expires_at > now()
  returning * into inv;

  if not found then
    -- spent, expired, or never existed — all the same answer, so a wrong token
    -- cannot be told apart from a used one
    return 'invalid';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (inv.team_id, uid, inv.role)
  on conflict (team_id, user_id) do nothing;

  return 'joined';
end;
$$;

revoke all on function public.create_invite_link(text, int) from anon, public;
revoke all on function public.redeem_invite_link(text) from anon, public;
grant execute on function public.create_invite_link(text, int) to authenticated;
grant execute on function public.redeem_invite_link(text) to authenticated;
