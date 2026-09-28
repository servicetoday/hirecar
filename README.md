# LIMO Australia

Express + MySQL chauffeur booking website inspired by the supplied design.

## Run locally

1. Install Node.js 18+ and MySQL.
2. Run `npm install`.
3. Create the database with `mysql -u root -p < schema.sql`.
4. Copy `.env.example` to `.env` and update the MySQL values.
5. Run `npm run dev`.
6. Open `http://localhost:3000`.

The Book now form posts to `POST /api/bookings` and stores records in the MySQL `bookings` table. The server creates this table on startup if missing, using the `quotes` table structure from `schema.sql`.

View today's bookings at `/bookings.html` (Sydney date). Quote requests remain separate in `quotes`, available at `/quotes.html` and through `POST /api/quotes`.

## Fleet administration

Open `/admin.html` and log in with the requested local demo account: username `altaf`, password `1234`.
Add, edit, or delete cars with a name, description, HTTP(S) image URL, and passenger capacity. The public pages `/fleets.html` and `/fleet.html` read these records from `GET /api/fleet`.

Startup automatically creates `admin_users`, `fleet_cars`, and `app_seeds`, and seeds the three original cars once. Deleting all cars does not re-create them on restart. Passwords are salted and hashed with scrypt; admin mutations require an authenticated session and CSRF token. Sessions expire after eight hours and are cleared when the server restarts. The supplied password is for local demonstration.
