# Trusted Places

Personal web app for saving, tagging, browsing, and planning around trusted food venues.

This project is built for one owner/admin. The public can browse saved places, while the admin can log in and manage places and tags.

## Stack

- Node.js
- Express
- SQLite
- EJS server-rendered views
- Plain CSS
- Minimal client-side JavaScript
- Leaflet for maps
- `express-session` for admin sessions
- `bcrypt` for password hashing
- `dotenv` for environment variables

## Features

- Public homepage, browse, place detail, nearby now, plan later, and map view
- Admin login/logout
- Admin place CRUD
- Admin tag management
- Tag groups for:
  - Category
  - Menu items
  - Gluten features
- Weekly opening hours
- Quick capture from Apple Maps or Google Maps share links

## Project Structure

- [`server.js`](/Users/jarrod/Documents/Vibe-coding/gluten-avoider/local-app/server.js): starts the app and initializes the database
- [`app.js`](/Users/jarrod/Documents/Vibe-coding/gluten-avoider/local-app/app.js): Express setup, sessions, shared middleware
- [`routes/`](/Users/jarrod/Documents/Vibe-coding/gluten-avoider/local-app/routes/public.js): public and admin routes
- [`views/`](/Users/jarrod/Documents/Vibe-coding/gluten-avoider/local-app/views/home.ejs): EJS templates
- [`public/`](/Users/jarrod/Documents/Vibe-coding/gluten-avoider/local-app/public/styles.css): CSS and small browser scripts
- [`db/`](/Users/jarrod/Documents/Vibe-coding/gluten-avoider/local-app/db/schema.sql): schema, queries, and DB helpers
- [`utils/`](/Users/jarrod/Documents/Vibe-coding/gluten-avoider/local-app/utils/place-form.js): parsing and helper logic
- [`scripts/`](/Users/jarrod/Documents/Vibe-coding/gluten-avoider/local-app/scripts/init-db.js): database init and seed scripts

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env
```

3. Edit [`.env`](/Users/jarrod/Documents/Vibe-coding/gluten-avoider/local-app/.env) and set:

```env
PORT=3000
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
DB_FILE=./data/trusted-places.sqlite
```

4. Initialize the database:

```bash
npm run db:init
```

5. Seed sample data:

```bash
npm run db:seed
```

6. Start the app:

```bash
npm start
```

Open `http://localhost:3000`.

## Admin Login

- Admin login URL: `http://localhost:3000/admin/login`
- Credentials come from `.env`
- If you change `ADMIN_USERNAME` or `ADMIN_PASSWORD`, run `npm run db:seed` again

## Main Routes

### Public

- `/`
- `/places`
- `/places/:slug`
- `/nearby`
- `/plan`
- `/map` and `/map/view`

### Admin

- `/admin/login`
- `/admin/logout`
- `/admin`
- `/admin/places`
- `/admin/places/new`
- `/admin/places/:id/edit`
- `/admin/tags`

## Quick Capture Notes

The add-place form supports a pasted Apple Maps or Google Maps share link.

Current behavior:

- the server follows the compact share-link redirect
- it tries to fill missing name, address, suburb, and coordinates
- if a field is already filled manually, the manual value wins

This is best-effort parsing, not full geocoding.

## Manual QA Checklist

- App starts cleanly with `npm start`
- Homepage loads
- Public browse page loads and filters work
- Place detail page loads
- Nearby now auto-locates or works with manual coordinates
- Plan later filters by category and menu-item tags
- Map view shows markers for places with coordinates
- Admin login works
- Admin place create works
- Admin place edit works
- Admin place delete works
- Admin tag create/edit/delete works
- Quick capture from a map share link fills missing fields
- Opening-hours parser accepts copied text from map apps

## Extending the Project

Good next improvements:

- better geocoding and map-link parsing
- photo/PDF upload for menus
- stronger map/list syncing
- cleanup of old unused schema fields if you want to simplify the data model further
- automated tests

## Notes

- Leaflet assets are currently loaded from the Leaflet CDN in the browser.
- SQLite database files are ignored in git by default.
