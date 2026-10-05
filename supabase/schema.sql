-- Hogar — schema + seguridad (Supabase)
-- Corré esto en: SQL Editor → New query → Run

-- Perfiles vinculados a auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  slug text not null unique check (slug in ('guadalupe', 'emanuel')),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Movimientos
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'shared', 'personal')),
  person text not null check (person in ('guadalupe', 'emanuel')),
  amount numeric(14, 2) not null check (amount > 0),
  category text not null,
  date date not null,
  note text not null default '',
  recurring boolean not null default false,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_date_idx on public.transactions (date desc);
create index if not exists transactions_type_idx on public.transactions (type);
create index if not exists transactions_person_idx on public.transactions (person);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

-- Helper: slug del usuario logueado
create or replace function public.my_slug()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select slug from public.profiles where id = auth.uid();
$$;

-- Profiles: cada uno ve ambos perfiles (nombres), solo se inserta/actualiza el propio
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Transactions SELECT
-- Casa + ingresos: visibles para los dos
-- Personal: solo el dueño (person = mi slug)
drop policy if exists "tx_select" on public.transactions;
create policy "tx_select"
  on public.transactions for select
  to authenticated
  using (
    type in ('income', 'shared')
    or (type = 'personal' and person = public.my_slug())
  );

-- INSERT
-- Personal e ingreso: solo a tu nombre
-- Casa: cualquiera de los dos puede anotar (quien pagó)
drop policy if exists "tx_insert" on public.transactions;
create policy "tx_insert"
  on public.transactions for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      (type = 'shared')
      or (type in ('income', 'personal') and person = public.my_slug())
    )
  );

-- UPDATE
drop policy if exists "tx_update" on public.transactions;
create policy "tx_update"
  on public.transactions for update
  to authenticated
  using (
    type = 'shared'
    or (type in ('income', 'personal') and person = public.my_slug())
  )
  with check (
    type = 'shared'
    or (type in ('income', 'personal') and person = public.my_slug())
  );

-- DELETE
drop policy if exists "tx_delete" on public.transactions;
create policy "tx_delete"
  on public.transactions for delete
  to authenticated
  using (
    type = 'shared'
    or (type in ('income', 'personal') and person = public.my_slug())
  );

-- Realtime (opcional pero recomendado)
alter publication supabase_realtime add table public.transactions;
