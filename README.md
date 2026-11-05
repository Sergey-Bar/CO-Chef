# Private Chef — Event Planning App

A local web app for planning meals for events (weddings, functions, gatherings).
Pick recipes, set your guest count, and Private Chef works out scaled quantities,
a shopping list, cost estimates, and a prep schedule.

## For non-technical users

1. **Install Node.js** if you don't have it (https://nodejs.org — LTS version).
   Install Python 3.12 as well and enable its PATH option. The launcher creates a virtual environment; it does not install Python.
2. **Double-click `start.cmd`** (or run `run.ps1` in PowerShell).
3. Wait for it to finish its one-time setup, then open
   the address printed by the launcher in your browser (normally
   **http://127.0.0.1:8000**; if occupied, the next available port is used).
4. To stop the app, press `Ctrl+C` in the window.

Your data is stored in a local file (`backend/cochef.db`). Use **Settings → Download
backup** to keep a copy.

## For developers

### Layout

- `backend/` — FastAPI + SQLAlchemy + SQLite app
  - `app/models.py` — data model
  - `app/scaling.py`, `app/units.py`, `app/costs.py`, `app/formatting.py` — core engine
  - `app/services/plan.py` — consolidated event plan computation
  - `app/seed.py` — starter recipes, ingredients with densities, canonical allergens
  - `tests/` — pytest suite
- `frontend/` — Vite + React + Tailwind + TypeScript SPA (builds to static assets served by FastAPI)

### Run in development

Backend (http://127.0.0.1:8000):

```
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Frontend (http://localhost:5173, proxies `/api` to the backend):

```
cd frontend
npm ci
npm run dev
```

### Tests

```
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Coverage includes scaling multipliers for all three models, portions-per-guest and
segment handling, buffer application, the segment-sum invariant, unit conversion
(including volume↔weight via density and missing-density flagging), cost aggregation
with other costs/tax, canonical allergen matching, alias-based ingredient aggregation,
display rounding rules (fractions and whole-item round-ups), and status transitions.

## Data model / concepts

- **Events** have a guest total, optional guest segments (which must sum to the total),
  a buffer %, and optional other costs / tax.
- **Recipes** scale by servings, per-person, or per-batch quantities.
- **Ingredients** are canonical records with aliases, a default purchasing unit, cost,
  and density (grams per mL) that enables volume↔weight conversion. Missing density is
  flagged rather than silently mis-converted.
- **Allergens** use a fixed canonical set shared by recipes and guest restrictions.

## Known notes

- No accounts/auth — local, single user.
- Recipe import supports pasted text and TXT, Markdown, DOCX, and PDF uploads (10 MB maximum).
- Quantities are stored precisely; displayed with practical fractions and round-ups
  that are visibly flagged.


## Personal business dashboard and profitability

The home page shows this month's estimated profit from completed jobs separately
from projected profit on open jobs, upcoming event count, and incomplete estimates.
Monthly and quarterly filters use calendar periods, excluding later periods.
The financial overview currently aggregates **ILS events only**; other currencies
remain available on individual events and are not converted automatically.
Open quote pipeline values use the application's default currency convention.

## Open Agent Hub

**Agents** lets you connect any local or external agent runtime — for example
OpenAI, Claude, n8n, a local model, or a custom script. Create an agent in the
app to receive a one-time access key. The agent can then publish an explainable
dashboard update using `POST /api/agents/{agent_id}/updates` with the
`X-CoChef-Agent-Key` header.

Agent updates support `urgent`, `warning`, `opportunity`, and `info` severity,
and may link only to an internal CO-Chef route. Agents have no write access to
events, prices, recipes, payments, or client data through this integration:
they publish findings; the chef reviews and acts. Keys are stored only as hashes
and are shown once at creation or rotation.

Costs include the quantity buffer. Price-book units are converted to purchasing
units before calculating cost. Unconvertible quantities, missing prices, or a
currency mismatch make the estimate incomplete. Revenue minus entered costs is an
**estimate**, not verified take-home earnings: include labor, assistants, travel,
equipment, and other expenses in each event's additional costs. The existing cost
tax setting applies to ingredients only. Payments are the source of collected cash.

In an event's Readiness tab, set a target margin to calculate the required quote
and per-guest price: cost / (1 - margin / 100). The initial 30% is editable and is
not a recommendation. The calculator requires a menu and complete ingredient pricing.

## Local backups and recovery

Every launch through `start.cmd` / `run.ps1` creates a timestamped snapshot in
`backend/backups/` before starting the server (when a database already exists).
Snapshots are retained; periodically move older copies to an external drive.
Settings → Download backup exports a complete SQLite `.db` snapshot, including
clients, leads, payments, pantry, and database settings. Browser appearance/default
preferences remain in browser local storage and are not included.

To restore: stop the app, preserve your current `backend/cochef.db`, then copy the
chosen backup to `backend/cochef.db` and restart. If using `COCHEF_DB`, restore to
that configured path instead. Never replace a database while the app is running.
Old JSON exports are partial exports and cannot be restored by this procedure.

## Repeatable verification

Run `./verify.ps1` after installing dependencies. It runs backend tests, frontend
lint, and a production build and stops on failure. A GitHub Actions workflow in
`.github/workflows/verify.yml` runs the same checks on pushes and pull requests
when this folder is committed to a GitHub repository.

The launcher checks dependency changes, uses `npm ci` only when its lockfile changes
or dependencies have not been stamped, rebuilds the interface,
and stops on command failures. Use `./run.ps1 -SkipBuild` only when deliberately
reusing a current frontend build. The app binds to `127.0.0.1` for local use.

If another server already uses port 8000, the launcher selects a free port and
prints the correct URL. Use that URL to avoid opening an older running version.
You can also request a port explicitly: `./run.ps1 -Port 8010`.
