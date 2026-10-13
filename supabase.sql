-- Jurnal Tabungan Berdua — jalankan di Supabase SQL Editor.
-- PENTING: jangan pernah menonaktifkan RLS atau memasukkan service_role key ke frontend.
create extension if not exists pgcrypto;

create table if not exists public.couples (
  id uuid primary key,
  name text not null default 'Our Little Savings',
  created_at timestamptz not null default now()
);

insert into public.couples (id, name)
values ('7b9e6f10-9d6a-4c2e-a57a-2a9c0d0b4e21', 'Our Little Savings')
on conflict (id) do nothing;

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('member','admin')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.savings_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  amount integer not null default 25000 check (amount = 25000),
  created_at timestamptz not null default now(),
  constraint savings_entries_one_per_member_per_week unique (couple_id, user_id, week_start),
  constraint savings_entries_monday check (extract(isodow from week_start) = 1)
);

create table if not exists public.couple_settings (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  my_name text not null default '',
  partner_name text not null default '',
  photo_url text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.couple_notes (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Function untuk cek keanggotaan tanpa recursive RLS policy.
create or replace function public.is_couple_member(check_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = check_couple_id and user_id = auth.uid()
  );
$$;
revoke all on function public.is_couple_member(uuid) from public;
grant execute on function public.is_couple_member(uuid) to authenticated;

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.savings_entries enable row level security;
alter table public.couple_settings enable row level security;
alter table public.couple_notes enable row level security;

drop policy if exists "members can read their couple" on public.couples;
create policy "members can read their couple" on public.couples
for select to authenticated using (public.is_couple_member(id));

drop policy if exists "members can read member list" on public.couple_members;
create policy "members can read member list" on public.couple_members
for select to authenticated using (public.is_couple_member(couple_id));

drop policy if exists "members can read shared savings" on public.savings_entries;
create policy "members can read shared savings" on public.savings_entries
for select to authenticated using (public.is_couple_member(couple_id));

drop policy if exists "members can add their own savings" on public.savings_entries;
create policy "members can add their own savings" on public.savings_entries
for insert to authenticated with check (
  public.is_couple_member(couple_id)
  and user_id = auth.uid()
  and amount = 25000
  and extract(isodow from week_start) = 1
);

drop policy if exists "members can read shared settings" on public.couple_settings;
create policy "members can read shared settings" on public.couple_settings
for select to authenticated using (public.is_couple_member(couple_id));

drop policy if exists "members can insert shared settings" on public.couple_settings;
create policy "members can insert shared settings" on public.couple_settings
for insert to authenticated with check (public.is_couple_member(couple_id) and updated_by = auth.uid());

drop policy if exists "members can update shared settings" on public.couple_settings;
create policy "members can update shared settings" on public.couple_settings
for update to authenticated using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id) and updated_by = auth.uid());

drop policy if exists "members can read shared notes" on public.couple_notes;
create policy "members can read shared notes" on public.couple_notes
for select to authenticated using (public.is_couple_member(couple_id));

drop policy if exists "members can insert shared notes" on public.couple_notes;
create policy "members can insert shared notes" on public.couple_notes
for insert to authenticated with check (public.is_couple_member(couple_id) and updated_by = auth.uid());

drop policy if exists "members can update shared notes" on public.couple_notes;
create policy "members can update shared notes" on public.couple_notes
for update to authenticated using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id) and updated_by = auth.uid());

grant select on public.couples, public.couple_members, public.savings_entries,
  public.couple_settings, public.couple_notes to authenticated;
grant insert on public.savings_entries, public.couple_settings, public.couple_notes to authenticated;
grant update on public.couple_settings, public.couple_notes to authenticated;

-- Cara menambahkan dua anggota:
-- 1. Daftarkan kedua akun melalui website, lalu konfirmasi email bila diminta.
-- 2. Buka Supabase Dashboard > Authentication > Users, salin UUID kedua akun.
-- 3. Jalankan query di bawah dengan UUID asli (ganti kedua placeholder).
-- insert into public.couple_members (couple_id, user_id, member_role)
-- values
-- ('7b9e6f10-9d6a-4c2e-a57a-2a9c0d0b4e21', 'UUID_AKUN_KAMU', 'admin'),
-- ('7b9e6f10-9d6a-4c2e-a57a-2a9c0d0b4e21', 'UUID_AKUN_PACAR', 'member')
-- on conflict do nothing;

-- Aktifkan Realtime untuk tabel berikut jika belum aktif:
-- Dashboard > Database > Publications / Replication > supabase_realtime
-- tambahkan savings_entries, couple_settings, couple_notes.
