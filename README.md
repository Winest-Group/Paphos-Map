# Paphos Projects Map · Winest Group

Internal tool for Winest Group real estate agents to visualize and search new construction projects in Paphos, Cyprus.

## Stack
- **Frontend:** Plain HTML + JavaScript + [Leaflet](https://leafletjs.com/) (OpenStreetMap)
- **Backend:** [Supabase](https://supabase.com) (Postgres + Auth)
- **Hosting:** GitHub Pages

## Features
- Interactive map of all active projects with status-colored pins
- Per-project popup: developer, area, sizes, prices, facilities, contact, drive link
- Filters: project name search, developer, area, budget ranges
- Admin panel: CRUD with click-on-map location picker, property types sub-table
- Developer defaults (drive link + contact) that propagate to all their projects
- Similar price suggestions (±10% same-bedrooms across other projects)

## Local development
```bash
# install deps (only needed for backend scripts)
npm install

# serve static files
npx http-server . -p 5500 -c-1
# open http://localhost:5500
```

## Backend scripts
Scripts in `scripts/` use the Supabase service_role key from `.env` to bypass RLS for bulk operations (insert projects, seed prices, etc.). The `.env` file is gitignored.

```bash
# example
node scripts/upload-domenica.js
```

## Access control
All routes require Supabase Auth login. Users are created manually via Supabase dashboard.
