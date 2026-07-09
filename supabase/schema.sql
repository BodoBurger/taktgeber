create extension if not exists "pgcrypto";

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  rounds integer not null default 1 check (rounds > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  duration_seconds integer not null check (duration_seconds > 0),
  break_seconds integer check (break_seconds is null or break_seconds >= 0),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists workouts_user_id_idx on public.workouts(user_id);
create index if not exists workouts_updated_at_idx on public.workouts(updated_at);
create index if not exists workouts_deleted_at_idx on public.workouts(deleted_at);
create index if not exists exercises_user_id_idx on public.exercises(user_id);
create index if not exists exercises_workout_id_idx on public.exercises(workout_id);
create index if not exists exercises_updated_at_idx on public.exercises(updated_at);
create index if not exists exercises_deleted_at_idx on public.exercises(deleted_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
before update on public.workouts
for each row
execute function public.set_updated_at();

drop trigger if exists exercises_set_updated_at on public.exercises;
create trigger exercises_set_updated_at
before update on public.exercises
for each row
execute function public.set_updated_at();

alter table public.workouts enable row level security;
alter table public.exercises enable row level security;

drop policy if exists "Users can select own workouts" on public.workouts;
create policy "Users can select own workouts"
on public.workouts
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own workouts" on public.workouts;
create policy "Users can insert own workouts"
on public.workouts
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workouts" on public.workouts;
create policy "Users can update own workouts"
on public.workouts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workouts" on public.workouts;
create policy "Users can delete own workouts"
on public.workouts
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can select own exercises" on public.exercises;
create policy "Users can select own exercises"
on public.exercises
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own exercises" on public.exercises;
create policy "Users can insert own exercises"
on public.exercises
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.workouts
    where workouts.id = exercises.workout_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own exercises" on public.exercises;
create policy "Users can update own exercises"
on public.exercises
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.workouts
    where workouts.id = exercises.workout_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own exercises" on public.exercises;
create policy "Users can delete own exercises"
on public.exercises
for delete
using (auth.uid() = user_id);
