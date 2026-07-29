-- Every policy in this schema is `to authenticated`, so the anon role can
-- already read nothing. Revoking makes that explicit instead of relying on RLS
-- alone, and takes these tables out of the public GraphQL schema.
revoke all on public.profiles, public.teams, public.team_members, public.invites,
              public.day_marks, public.day_notes, public.tasks, public.task_updates
  from anon;

-- Trigger functions are invoked by the trigger, never by a client. They do not
-- belong on the REST surface as callable RPCs.
revoke all on function public.handle_new_user() from anon, authenticated;
revoke all on function public.drop_private_tasks_with_owner() from anon, authenticated;

-- The membership helpers are evaluated inside policies, which run as the
-- querying user, so authenticated must keep EXECUTE. Anon never reaches a
-- policy that calls them.
revoke all on function public.is_team_member(uuid) from anon;
revoke all on function public.is_teammate(uuid) from anon;
