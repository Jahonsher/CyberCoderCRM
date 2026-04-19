# CyberCoderCRM

Multi-tenant CRM system for small and medium businesses. Built with Node.js, Express, MongoDB, and vanilla JavaScript with Tailwind CSS.

## Features

- **Multi-tenant architecture** — SuperAdmin manages multiple businesses
- **White-label support** — each business sees its own logo and name
- **Employee management** — add, edit, delete with unique codes
- **Direction-based income** — assign employees to directions with daily price snapshots
- **Daily reports** — full/half shift tracking (1 or 0.5)
- **Monthly reports** — search by employee code, calculate total earnings
- **Archive system** — snapshot daily/weekly/monthly data
- **Auto-reset** — daily cron at 03:00 resets assignments
- **Multi-language** — Uzbek (Latin), Uzbek (Cyrillic), Russian
- **Security hardening** — helmet, rate limit, XSS clean, mongo sanitize

## Stack

- **Backend:** Node.js 18+, Express, MongoDB (Mongoose), JWT
- **Frontend:** HTML5, Tailwind CSS, Vanilla JS
- **Deploy:** Railway + MongoDB Atlas

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env

# 3. Fill in .env with your values
# 4. Run the server
npm start
```

## Project Structure

```
CyberCoderCRM/
├── backend/
│   ├── config/          # DB connection
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API endpoints
│   ├── middleware/      # Auth, security, tenant isolation
│   ├── services/        # Cron jobs, background tasks
│   ├── utils/           # Helpers
│   └── server.js        # Entry point
├── client/
│   ├── superadmin/      # SuperAdmin panel UI
│   ├── admin/           # Business admin panel UI
│   └── shared/          # Language, shared utilities
├── uploads/             # Business logos
└── .env
```

## API Endpoints (overview)

### Auth
- `POST /api/auth/login` — login (admin or superadmin)
- `GET /api/auth/me` — current user info

### SuperAdmin
- `GET /api/superadmin/businesses` — list all businesses
- `POST /api/superadmin/businesses` — create business (with logo)
- `PUT /api/superadmin/businesses/:id` — update business
- `DELETE /api/superadmin/businesses/:id` — delete business
- `POST /api/superadmin/businesses/:id/suspend` — suspend/activate

### Admin (per business)
- `GET /api/employees` — list employees
- `POST /api/employees` — create employee
- `PUT /api/employees/:id` — update
- `DELETE /api/employees/:id` — soft delete (reserve code)

- `GET /api/directions` — list directions
- `POST /api/directions` — create direction
- `PUT /api/directions/:id` — update (new price applies from today)

- `GET /api/daily-report` — today's assignments + products
- `POST /api/daily-report/assign` — assign employee to direction
- `POST /api/daily-report/products` — log daily product

- `GET /api/monthly-report` — search by code, date range
- `POST /api/monthly-report/archive` — archive selected period

- `GET /api/archive` — list archives

## Deployment

See `DEPLOY.md` for Railway + MongoDB Atlas setup.

## License

ISC © Jahonsher