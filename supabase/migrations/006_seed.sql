-- FindrYU schema, part 6 of 6. Keele seed data.
-- Hours are placeholders. Admins can edit them later.
-- Running this file again does not overwrite rows that already exist.

insert into public.locations (name, kind, building, room, hours, is_drop_off, active)
values
  (
    'Central Lost & Found',
    'central',
    'Ross Building South',
    '107',
    'Mon to Fri 11:30am to 3:45pm, winter hours. Confirm with Community Safety',
    true,
    true
  ),
  (
    'Scott Library circulation desk',
    'library',
    'Scott Library',
    'Circulation desk',
    'Confirm with the Scott Library circulation desk',
    true,
    true
  ),
  (
    'Steacie Science and Engineering Library circulation desk',
    'library',
    'Steacie Science and Engineering Library',
    'Circulation desk',
    'Confirm with the Steacie circulation desk',
    true,
    true
  ),
  (
    'Peter F. Bronfman Business Library circulation desk',
    'library',
    'Seymour Schulich Building',
    'Circulation desk',
    'Confirm with the Bronfman Library circulation desk',
    true,
    true
  ),
  (
    'York Security Services',
    'security',
    'Confirm with Community Safety',
    null,
    'Confirm with York Security Services. Used for passports and after-hours pickup',
    false,
    true
  ),
  (
    'YU Card Office',
    'yu_card_office',
    'Confirm with the YU Card Office',
    null,
    'Confirm with the YU Card Office. Used for YU-cards',
    false,
    true
  )
on conflict (name) do nothing;

insert into public.buildings (name)
values
  ('Vari Hall'),
  ('Ross Building'),
  ('Central Square'),
  ('Scott Library'),
  ('Steacie Science and Engineering Library'),
  ('Seymour Schulich Building'),
  ('Student Centre'),
  ('York Lanes'),
  ('Accolade East'),
  ('Accolade West'),
  ('Bergeron Centre for Engineering Excellence'),
  ('Lassonde Building'),
  ('Curtis Lecture Halls'),
  ('Tait McKenzie Centre'),
  ('Other / not sure')
on conflict (name) do nothing;

insert into public.categories (name, special_handling)
values
  ('Phone', 'none'),
  ('Laptop or tablet', 'none'),
  ('Headphones or earbuds', 'none'),
  ('Other electronics', 'none'),
  ('Keys', 'none'),
  ('Wallet or purse', 'none'),
  ('YU-card', 'yu_card'),
  ('Passport', 'passport'),
  ('Other ID card', 'none'),
  ('Bag or backpack', 'none'),
  ('Clothing', 'none'),
  ('Water bottle', 'none'),
  ('Books or notes', 'none'),
  ('Jewellery or accessories', 'none'),
  ('Umbrella', 'none'),
  ('Other', 'none')
on conflict (name) do nothing;

insert into public.settings (key, value)
values
  ('holding_period_days', '30'),
  ('no_proof_hold_days', '7'),
  ('contact_retention_days', '180')
on conflict (key) do nothing;
