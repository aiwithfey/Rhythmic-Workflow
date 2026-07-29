-- Adding people directly is an owner's job, and the edge function checks this
-- role before it touches the service-role key. Make sure the account that runs
-- the team actually holds it.
update public.team_members tm
   set role = 'owner'
  from auth.users u
 where u.id = tm.user_id
   and lower(u.email) = 'feypelleg@gmail.com';
