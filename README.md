# College Event Portal

A React dashboard for students and staff to discover campus events, submit registrations, and manage event listings. The Node.js API persists accounts, events, and registrations as JSON data in `backend/data/`.

## Run locally

Use Node.js 20.19+ or 22.12+.

1. Install dependencies with `npm install`.
2. Start the complete app with `npm run dev`.
3. Open the URL printed by Vite (usually `http://localhost:5173`).

The development command starts the API on port 3001, waits for its health endpoint, and then starts Vite with `/api` proxying to the API. Set `API_PORT` to use a different API port.

To run the API on its own, use `npm run server`.

## Demo accounts

- Student: `student@college.edu` / `student123`
- Staff: `staff@college.edu` / `staff123`

New accounts are student accounts and require a password of at least 8 characters. Staff accounts can create events, review registrations, and view inter-college and external-college participants. Students can edit their profiles, browse all events, and register once per event. Demo participant rows are seeded for both college categories.

Event cards show the event date/time range and registration closing date. New events require start/end dates, start/end times, and a registration close date.

## API

- `GET /api/health`
- `POST /api/auth/login`, `POST /api/auth/signup`, `GET /api/auth/me`
- `PATCH /api/profile`
- `GET /api/events`, `POST /api/events` (staff)
- `GET /api/registrations`, `POST /api/registrations` (student), `PATCH /api/registrations/:id` (staff)

Passwords are stored as salted scrypt hashes. API sessions are signed bearer tokens, and generated database/session files are excluded from version control.
