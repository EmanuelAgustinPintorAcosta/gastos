-- Completá ESTO DESPUÉS de crear los 2 usuarios en Authentication → Users
-- Reemplazá los UUID con los de cada usuario (Authentication → Users → copiar User UID)

-- Guadalupe
insert into public.profiles (id, slug, display_name)
values (
  'PEGAR-UUID-DE-GUADA',
  'guadalupe',
  'Guadalupe'
)
on conflict (id) do update
set slug = excluded.slug,
    display_name = excluded.display_name;

-- Emanuel
insert into public.profiles (id, slug, display_name)
values (
  'PEGAR-UUID-DE-EMA',
  'emanuel',
  'Emanuel'
)
on conflict (id) do update
set slug = excluded.slug,
    display_name = excluded.display_name;
