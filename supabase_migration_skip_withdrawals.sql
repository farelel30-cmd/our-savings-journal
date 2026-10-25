-- Our Savings Journal: migration for shared skip schedule and withdrawals.
-- Run this file once in Supabase SQL Editor. It does not reset existing savings.
create table if not exists public.skipped_weeks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  week_start date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint skipped_weeks_monday check (extract(isodow from week_start) = 1),
  constraint skipped_weeks_one_per_couple_week unique (couple_id, week_start)
);

create table if not exists public.savings_withdrawals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.skipped_weeks enable row level security;
alter table public.savings_withdrawals enable row level security;

drop policy if exists "members can read skipped weeks" on public.skipped_weeks;
create policy "members can read skipped weeks" on public.skipped_weeks
for select to authenticated using (public.is_couple_member(couple_id));

drop policy if exists "members can skip a week" on public.skipped_weeks;
create policy "members can skip a week" on public.skipped_weeks
for insert to authenticated with check (
  public.is_couple_member(couple_id)
  and user_id = auth.uid()
  and extract(isodow from week_start) = 1
);

drop policy if exists "members can read shared withdrawals" on public.savings_withdrawals;
create policy "members can read shared withdrawals" on public.savings_withdrawals
for select to authenticated using (public.is_couple_member(couple_id));

drop policy if exists "members can skip a week" on public.skipped_weeks;
grant select on public.skipped_weeks, public.savings_withdrawals to authenticated;

-- Skip the weekly deposit atomically and only if nobody has already deposited.
create or replace function public.skip_shared_week(p_couple_id uuid, p_week_start date)
returns uuid
language plpgsql
security definer
set search_path = public
as $skip$
declare
  v_skip_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.is_couple_member(p_couple_id) then
    raise exception 'Akun ini bukan anggota pasangan tersebut.';
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'Tanggal jadwal harus hari Senin.';
  end if;

  perform 1 from public.couples where id = p_couple_id for update;
  if not found then
    raise exception 'Data pasangan tidak ditemukan.';
  end if;
  if exists (
    select 1 from public.savings_entries
    where couple_id = p_couple_id and week_start = p_week_start
  ) then
    raise exception 'Jadwal tidak bisa dilewati karena sudah ada setoran yang tercatat.';
  end if;

  insert into public.skipped_weeks (couple_id, week_start, user_id)
  values (p_couple_id, p_week_start, auth.uid())
  returning id into v_skip_id;
  return v_skip_id;
end;
$skip$;

revoke all on function public.skip_shared_week(uuid, date) from public;
grant execute on function public.skip_shared_week(uuid, date) to authenticated;

-- Atomically validate and record a withdrawal. Locking the couple row serializes
-- simultaneous withdrawal attempts so they cannot spend the same balance twice.
create or replace function public.withdraw_shared_savings(p_couple_id uuid, p_amount integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_withdrawal_id uuid;
  v_balance bigint;
begin
  if auth.uid() is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.is_couple_member(p_couple_id) then
    raise exception 'Akun ini bukan anggota pasangan tersebut.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal penarikan harus lebih dari Rp0.';
  end if;

  perform 1 from public.couples where id = p_couple_id for update;
  if not found then
    raise exception 'Data pasangan tidak ditemukan.';
  end if;

  select coalesce((select sum(amount)::bigint from public.savings_entries where couple_id = p_couple_id), 0)
       - coalesce((select sum(amount)::bigint from public.savings_withdrawals where couple_id = p_couple_id), 0)
    into v_balance;

  if p_amount > v_balance then
    raise exception 'Saldo tidak cukup. Saldo tersedia saat ini Rp%.', to_char(greatest(v_balance,0), 'FM999G999G999G990');
  end if;

  insert into public.savings_withdrawals (couple_id, user_id, amount)
  values (p_couple_id, auth.uid(), p_amount)
  returning id into v_withdrawal_id;

  return v_withdrawal_id;
end;
$$;

revoke all on function public.withdraw_shared_savings(uuid, integer) from public;
grant execute on function public.withdraw_shared_savings(uuid, integer) to authenticated;

-- Enable Realtime for these tables in Supabase Dashboard > Database > Publications
-- if they are not already in supabase_realtime: skipped_weeks, savings_withdrawals.
