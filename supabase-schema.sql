-- ─────────────────────────────────────────────────────────────────────────────
-- ClientFlow — Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── CLIENTS ─────────────────────────────────────────────────────────────────
create table if not exists clients (
  id                uuid primary key default uuid_generate_v4(),
  company           text not null,
  alias             text,
  email             text,
  facebook_url      text,
  google_drive_url  text,
  status            text not null default 'active',   -- active | inactive
  transition_status text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── PRODUCTS ────────────────────────────────────────────────────────────────
create table if not exists products (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  type        text not null,   -- ST | CO | DS | OH
  order_num   numeric,
  description text
);

-- Seed product catalog
insert into products (name, type, order_num) values
  ('Website',          'ST', 1.0),
  ('Website Updates',  'CO', 1.1),
  ('Email Template',   'ST', 1.2),
  ('Facebook Posts',   'CO', 2.0),
  ('Content Strategy', 'CO', 2.1),
  ('Campaign',         'CO', 2.2),
  ('ENews Blog',       'CO', 2.3),
  ('Facebook Set Up',  'ST', 3.0),
  ('Logo',             'DS', 4.0),
  ('Print',            'DS', 4.1),
  ('Publication',      'DS', 4.2),
  ('Web App',          'ST', 5.0),
  ('R&D',              'OH', 6.0),
  ('Accounting',       'OH', 6.1),
  ('Misc',             'OH', 6.2),
  ('Sales',            'OH', 6.3)
on conflict do nothing;

-- ── PROJECTS ────────────────────────────────────────────────────────────────
create table if not exists projects (
  id              uuid primary key default uuid_generate_v4(),
  project_number  text unique,
  name            text not null,
  client_id       uuid references clients(id) on delete set null,
  product_id      uuid references products(id) on delete set null,
  manager_id      uuid,   -- references auth.users later
  -- status fields
  product_type    text default 'CO',   -- ST | CO | DS | OH (denormalized for speed)
  priority        text default 'Normal', -- Now | Hot All | Hot Area | Normal
  area            text,
  est_status      text default 'Open',
  proof_status    text default 'Open',
  inv_status      text default 'Open',
  collect_status  text default 'Open',
  -- financials
  est_amount      numeric(10,2) default 0,
  client_owed     numeric(10,2) default 0,
  client_paid     numeric(10,2) default 0,
  team_owed       numeric(10,2) default 0,
  team_paid       numeric(10,2) default 0,
  -- dates
  start_date      date,
  end_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── PROOFS ──────────────────────────────────────────────────────────────────
create table if not exists proofs (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid references projects(id) on delete cascade,
  created_by     uuid,
  version        integer not null default 1,
  content        text,
  image_url      text,
  status         text not null default 'Open',  -- Open | Approved | Revise | No Go
  boost          boolean default false,
  scheduled_date date,
  created_at     timestamptz not null default now()
);

-- ── CAMPAIGNS ───────────────────────────────────────────────────────────────
create table if not exists campaigns (
  id         uuid primary key default uuid_generate_v4(),
  client_id  uuid references clients(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name       text not null,
  benefit    text,
  proof      text,
  cta        text,
  status     text default 'draft',  -- draft | active | complete
  start_date date,
  end_date   date,
  created_at timestamptz not null default now()
);

-- ── CAMPAIGN DELIVERABLES ───────────────────────────────────────────────────
create table if not exists campaign_deliverables (
  id             uuid primary key default uuid_generate_v4(),
  campaign_id    uuid references campaigns(id) on delete cascade,
  channel        text not null,  -- social | email | print | web
  content_url    text,
  status         text default 'draft',
  scheduled_date date,
  published      boolean default false,
  created_at     timestamptz not null default now()
);

-- ── CALENDAR EVENTS ─────────────────────────────────────────────────────────
create table if not exists calendar_events (
  id             uuid primary key default uuid_generate_v4(),
  client_id      uuid references clients(id) on delete cascade,
  campaign_id    uuid references campaigns(id) on delete set null,
  deliverable_id uuid references campaign_deliverables(id) on delete set null,
  title          text not null,
  event_date     date not null,
  channel        text,
  status         text default 'scheduled',
  color_tag      text
);

-- ── TIME ENTRIES ────────────────────────────────────────────────────────────
create table if not exists time_entries (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid references projects(id) on delete set null,
  user_id     uuid,
  entry_date  date not null,
  hours       numeric(5,2) not null,
  description text,
  category    text,
  created_at  timestamptz not null default now()
);

-- ── INVOICES ────────────────────────────────────────────────────────────────
create table if not exists invoices (
  id             uuid primary key default uuid_generate_v4(),
  client_id      uuid references clients(id) on delete set null,
  project_id     uuid references projects(id) on delete set null,
  invoice_number text unique,
  amount         numeric(10,2) not null,
  status         text default 'Open',  -- Open | Sent | Paid | Overdue
  issued_date    date,
  due_date       date,
  paid_date      date,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ── AUDIENCE METRICS ────────────────────────────────────────────────────────
create table if not exists audience_metrics (
  id               uuid primary key default uuid_generate_v4(),
  client_id        uuid references clients(id) on delete cascade,
  channel          text not null,  -- facebook | email | mailing
  follower_count   integer,
  email_list_size  integer,
  mailing_list_size integer,
  recorded_date    date not null,
  created_at       timestamptz not null default now()
);

-- ── PROJECT TEAM (many-to-many) ─────────────────────────────────────────────
create table if not exists project_team (
  project_id uuid references projects(id) on delete cascade,
  user_id    uuid,
  primary key (project_id, user_id)
);

-- ── AUTO-UPDATE updated_at ──────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at  before update on clients  for each row execute function update_updated_at();
create trigger projects_updated_at before update on projects for each row execute function update_updated_at();

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- For now: enable RLS but allow all authenticated users full access.
-- Phase 2 will add role-based policies (Manager vs Client vs Team).

alter table clients              enable row level security;
alter table products             enable row level security;
alter table projects             enable row level security;
alter table proofs               enable row level security;
alter table campaigns            enable row level security;
alter table campaign_deliverables enable row level security;
alter table calendar_events      enable row level security;
alter table time_entries         enable row level security;
alter table invoices             enable row level security;
alter table audience_metrics     enable row level security;

-- Full access for authenticated users (managers and team)
create policy "Authenticated full access" on clients              for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on products             for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on projects             for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on proofs               for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on campaigns            for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on campaign_deliverables for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on calendar_events      for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on time_entries         for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on invoices             for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on audience_metrics     for all to authenticated using (true) with check (true);
