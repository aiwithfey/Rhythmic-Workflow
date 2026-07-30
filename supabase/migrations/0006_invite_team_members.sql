-- Adding these four addresses to the closed-team allow-list: the
-- `handle_new_user` trigger from 0001 auto-joins a new sign-in to the team
-- when its email matches a row here, then removes the row.
--
-- This only covers app-level team membership. Whoever added these emails
-- also needs to add them as test users in Google Cloud Console (OAuth
-- consent screen → test users), since that allow-list is what actually
-- gates who can authenticate with Google at all.

insert into public.invites (email, team_id, role)
select email, (select id from public.teams limit 1), 'member'
from unnest(array[
  'illouzdana4@gmail.com',
  'immamagshima@gmail.com',
  'oriankarmon@gmail.com',
  'yos12sas@gmail.com'
]) as email
on conflict (email) do nothing;
