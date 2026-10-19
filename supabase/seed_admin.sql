-- Promote one signed-in York account to admin.
-- Do this only after that person has signed in once, so a profile row exists.
-- Replace the email, then run this file in the Supabase SQL Editor.

do $$
declare
  target_email text := 'ag23@my.yorku.ca';
  updated_count integer;
begin
  if target_email = 'you@yorku.ca' then
    raise exception 'Replace you@yorku.ca with the York email you signed in with';
  end if;

  update public.profiles
  set
    role = 'admin',
    location_id = null
  where email = lower(target_email);

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    raise exception 'No profile for %. Sign in with that York email first, then run this again.', target_email;
  end if;
end;
$$;
