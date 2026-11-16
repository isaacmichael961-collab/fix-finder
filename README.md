# FixFinder — starter MVP

FixFinder is a handyman marketplace starter built with HTML, CSS, JavaScript, Node.js, Express and PostgreSQL.

## Included in this starter

- Responsive Bolt-inspired booking/search interface (original FixFinder branding)
- Customer and handyman registration, login, password hashing and JWT sessions
- Search approved providers by keyword and service area
- Admin-only manual provider creation endpoint
- Handyman self-application endpoint; new profiles remain pending until admin approval
- Customer booking requests and role-aware booking status updates
- Booking-linked in-app text messages API
- Reviews restricted to customers' completed bookings
- PostgreSQL schema and API health endpoint

## Requirements

Install Node.js LTS and PostgreSQL. Use VS Code to open this folder.

## 1. Create the database

In PostgreSQL (using pgAdmin or `psql`), create a database named `fixfinder`, then run the SQL in `db/schema.sql` against that database.

Example with `psql`:

```bash
createdb fixfinder
psql -d fixfinder -f db/schema.sql
```

## 2. Configure environment

Copy `.env.example` to `.env`, then update `DATABASE_URL` with your local PostgreSQL username/password. Replace `JWT_SECRET` with a long random secret.

Example:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/fixfinder
JWT_SECRET=put_a_long_random_secret_here
```

Do not share your `.env` file or upload it to GitHub.

## 3. Install and run

In the VS Code terminal, from this project folder:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Check `http://localhost:3000/api/health` to confirm the server can reach PostgreSQL.

## 4. Create the first administrator

Public registration intentionally cannot create an admin account. First register normally, then promote that user using PostgreSQL. Replace the email with the account you created:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Log out and log back in so the new role is included in your session token.

The admin-only provider endpoint is `POST /api/providers/admin`. Example JSON:

```json
{
  "display_name": "Amina Electrical Services",
  "category": "Electrician",
  "description": "Residential electrical repairs and installations.",
  "service_area": "Wuse, Abuja",
  "phone": "08000000000",
  "price_from": 5000,
  "verified": true
}
```

Send an admin JWT in the `Authorization: Bearer YOUR_TOKEN` header.

## Main API routes

- `POST /api/auth/register` — create customer or handyman account
- `POST /api/auth/login` — log in
- `GET /api/auth/me` — current account
- `GET /api/providers?search=&category=&area=` — search approved providers
- `POST /api/providers/apply` — handyman submits or updates own profile
- `POST /api/providers/admin` — admin adds a provider manually
- `GET /api/providers/admin/pending` — admin lists pending profiles
- `PATCH /api/providers/admin/:id/approval` — admin approves/rejects a profile
- `POST /api/bookings` — customer creates a booking
- `GET /api/bookings/mine` — current user's bookings
- `PATCH /api/bookings/:id/status` — provider accepts/declines/completes; customer can cancel
- `GET /api/messages/:bookingId` and `POST /api/messages` — booking-linked messaging
- `POST /api/reviews` — customer reviews a completed booking
- `GET /api/reviews/provider/:providerId` — provider reviews

## Important MVP notes

This is a working starter, not yet production-ready. Before launching publicly, add rate limiting, email verification and password reset, stronger admin management UI, validation/rate limits, message polling or WebSockets for live chat, image upload/storage, pagination, CSRF/security hardening as appropriate, privacy/terms pages, backups, deployment secrets, and tests. The initial UI exposes the main search, registration, booking and review flows; the complete admin and messaging screens are the next development step. Never treat a provider as verified until you have checked their identity/credentials and updated the status accordingly.
