-- Run this entire script in Supabase Dashboard -> SQL Editor -> New query.
create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '',
  due_date date not null,
  priority text not null default 'Средний' check (priority in ('Низкий','Средний','Высокий')),
  level text not null default 'Средняя' check (level in ('Низкая','Средняя','Высокая')),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_due_date_idx on public.tasks (user_id, due_date);
create index if not exists tasks_user_id_created_at_idx on public.tasks (user_id, created_at desc);

alter table public.tasks enable row level security;

-- Each authenticated user can only read/write rows with their own user_id.
drop policy if exists "Users can read their own tasks" on public.tasks;
create policy "Users can read their own tasks" on public.tasks for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tasks" on public.tasks;
create policy "Users can insert their own tasks" on public.tasks for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks" on public.tasks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks" on public.tasks for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.tasks to authenticated;
