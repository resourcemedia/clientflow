-- Enable RLS with manager-only access across ClientFlow tables
-- Applied manually via Supabase SQL editor on 2026-07-07.
-- This file version-controls that state; it is NOT meant to be re-applied to prod
-- (policies already exist). Kept for reproducibility on rebuild/branch.

-- Helper: security-definer role check.
-- Reads profiles bypassing RLS (no recursion); lets every policy check role safely.
create or replace function public.is_manager()
returns boolean language sql security definer stable
set search_path = public
as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'manager') $$;

-- ── Stage 1: portal tables (RLS already on; swap permissive policy for manager-only) ──
drop policy "Authenticated full access" on project_items;
create policy "Manager full access" on project_items for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy "Authenticated full access" on projects;
create policy "Manager full access" on projects for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy "Authenticated full access" on proofs;
create policy "Manager full access" on proofs for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy "Authenticated full access" on tasks;
create policy "Manager full access" on tasks for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy "Authenticated full access" on clients;
create policy "Manager full access" on clients for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- ── Stage 2: financial/config tables (create policy, then enable RLS) ──
create policy "Manager full access" on app_config for all to authenticated using (public.is_manager()) with check (public.is_manager());
alter table app_config enable row level security;

create policy "Manager full access" on cashflow_entries for all to authenticated using (public.is_manager()) with check (public.is_manager());
alter table cashflow_entries enable row level security;

create policy "Manager full access" on invoice_items for all to authenticated using (public.is_manager()) with check (public.is_manager());
alter table invoice_items enable row level security;

drop policy "Authenticated full access" on invoices;
create policy "Manager full access" on invoices for all to authenticated using (public.is_manager()) with check (public.is_manager());
alter table invoices enable row level security;

-- ── Stage 3: cleanup + special cases ──
-- calendar_events is retired: deny-all now, drop table later once refs are zero.
drop policy "Authenticated full access" on calendar_events;
alter table calendar_events enable row level security;

-- products had TWO permissive policies.
drop policy "Allow all for authenticated" on products;
drop policy "Authenticated full access" on products;
create policy "Manager full access" on products for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy "Authenticated full access" on campaigns;
create policy "Manager full access" on campaigns for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy "Authenticated full access" on campaign_deliverables;
create policy "Manager full access" on campaign_deliverables for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy "Authenticated full access" on audience_metrics;
create policy "Manager full access" on audience_metrics for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- profiles: NOT manager-only — a user must read their own row for the app to know who they are.
drop policy "Authenticated full access" on profiles;
create policy "Own row or manager" on profiles for all to authenticated using (id = auth.uid() or public.is_manager()) with check (id = auth.uid() or public.is_manager());
