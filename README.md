# ClientFlow — Marketing Management App

Your client marketing management platform. Built with React + Vite + Supabase.

---

## What's built (Phase 1)

- **Dashboard** — stats, active campaigns, activity feed, audience growth
- **Clients** — full list, add/edit modal, search, status tracking
- **Client detail** — per-client project history, financials, notes
- **Projects** — work view + financial view, add/edit modal, search, financial totals
- **Theme toggle** — dark/light mode, persists across sessions
- **Demo mode** — runs with sample data if no Supabase credentials are set
- Placeholder pages for: Campaigns, Calendar, Proofs, Time board, Billing (Phase 2)

---

## Setup — two ways to run this

### Option A: Demo mode (fastest — no account needed)

Just run it locally and the app uses built-in sample data.

```bash
# 1. Open a terminal and navigate to this folder
cd clientflow

# 2. Install dependencies (requires Node.js — download from nodejs.org if needed)
npm install

# 3. Start the app
npm run dev

# 4. Open your browser to http://localhost:5173
```

That's it. You'll see the demo banner at the top. All data is read-only sample data.

---

### Option B: Connect to Supabase (real database)

This is how you go from prototype to real app. Takes about 10 minutes.

#### Step 1 — Create a free Supabase account
1. Go to https://supabase.com and sign up (free)
2. Click **New project**, give it a name (e.g. "clientflow"), set a database password, pick a region close to you
3. Wait ~2 minutes for the project to be created

#### Step 2 — Run the database schema
1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase-schema.sql` from this folder
4. Copy the entire contents and paste it into the SQL editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned." — that means all tables were created

#### Step 3 — Get your credentials
1. In Supabase, go to **Settings** → **API**
2. Copy two values:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

#### Step 4 — Create your .env file
In the `clientflow` folder, create a file called `.env` (just that, no extension):

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with your actual URL and key from Step 3.

#### Step 5 — Run the app
```bash
npm install
npm run dev
```

The demo banner will be gone. You now have a live database. Add a client — it saves to Supabase instantly.

---

## Project structure

```
clientflow/
├── src/
│   ├── App.jsx                    # Root — routing + layout
│   ├── main.jsx                   # React entry point
│   ├── styles.css                 # All CSS — dark + light theme variables
│   │
│   ├── lib/
│   │   ├── supabase.js            # Supabase client (reads .env)
│   │   ├── theme.jsx              # Theme context + toggle
│   │   └── demo-data.js           # Sample data for demo mode
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.jsx        # Navigation sidebar with theme toggle
│   │   └── ui/
│   │       └── index.jsx          # Shared components: Badge, Modal, StatCard, etc.
│   │
│   └── pages/
│       ├── Dashboard.jsx          # Home screen
│       ├── Clients.jsx            # Client list + add/edit
│       ├── ClientDetail.jsx       # Single client view with projects
│       ├── Projects.jsx           # Projects — work + financial views
│       └── Placeholders.jsx       # Coming-soon pages for Phase 2
│
├── supabase-schema.sql            # Run this in Supabase SQL Editor
├── package.json                   # Dependencies
├── vite.config.js                 # Build config
└── index.html                     # HTML shell
```

---

## How the Supabase connection works

The app checks for `VITE_SUPABASE_URL` at startup. If it's missing, all data calls use the local `demo-data.js` arrays instead of hitting the database. This means:

- **No .env** → demo mode, read-only sample data, no save
- **.env present** → live mode, reads and writes to your Supabase database

Every page follows the same pattern:
```js
const isDemo = !import.meta.env.VITE_SUPABASE_URL

if (isDemo) {
  setData(DEMO_DATA)
} else {
  const { data } = await supabase.from('table').select('*')
  setData(data)
}
```

This pattern is used consistently so you can build and test without needing credentials, then flip to live when ready.

---

## Phase 2 — what's coming next

The placeholder pages will become full modules:
- **Campaigns** — message builder (benefit + proof + CTA), channel selection, deliverable tracking
- **Calendar** — monthly content calendar with color-coded channel events
- **Proofs** — review board with Approve / Revise / No Go workflow, version history
- **Time board** — weekly grid by team member, project time logs
- **Billing** — invoice management, revenue by client

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 |
| Build tool | Vite |
| Routing | React Router v6 |
| Backend + database | Supabase (Postgres) |
| Icons | Lucide React |
| Date utilities | date-fns |
| Fonts | DM Sans, DM Mono, Fraunces (Google Fonts) |

