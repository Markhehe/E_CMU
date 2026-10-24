# E-CMU Portal

The React/Vite frontend lives in this repository root. The Express API and its
PostgreSQL/Drizzle files live in `server/`.

## Run the frontend

From this directory:

```sh
npm install
npm run dev
```

## Run the backend

In a second terminal:

```sh
cd server
npm ci
```

Copy `server/.env.example` to `server/.env` and set the database connection
string, JWT secret, and SMTP settings. Configure `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` with your email
provider's SMTP credentials so the API can deliver account-confirmation,
pickup, comment, and payment confirmation emails.
Back up an existing database before applying pending migrations, then run:

```sh
npm run db:migrate
npm run seed
npm run dev
```

The ordered SQL files in `server/src/db/migrations/` are the canonical
migrations. Both `npm run migrate` and `npm run db:migrate` apply that same
sequence; do not apply the separate Drizzle Kit-generated SQL files directly.
The student-name typo-tolerant search uses PostgreSQL's `pg_trgm` extension;
the migration runner's database role must be allowed to create that extension.

The seed command ensures one registrar account, 30 mock student login accounts,
and the document catalog. Student IDs are unique eight-digit values with a
2023-2026 year prefix; account emails use the matching ID at
`@cityofmalabonuniversity.edu.ph`. It also adds
`20230554@cityofmalabonuniversity.edu.ph` to the student directory without
creating an account for it, so registration can be tested against a
directory-only record. All newly created demo accounts use
`SEED_TEST_PASSWORD` from `server/.env`; rerunning the seed does not reset
existing passwords. Students must still submit clearance through the portal
before making requests.

The API defaults to `http://localhost:5000`; the frontend defaults to
`http://localhost:5173`. The frontend signs in through the API and loads the
document catalog and requests from PostgreSQL. To use another API URL, set
`VITE_API_URL` in the frontend environment.

New student accounts must match a directory record, then confirm their university email address using the
six-digit code sent during registration before they can sign in. Codes expire
after 120 seconds and are invalidated after five incorrect attempts. Users can
request a new code from the sign-in screen.
Existing accounts remain verified when the email-verification migration is
applied.

Requests display a unique six-character hexadecimal code. Their UUID remains
the internal database and API identifier. Back up the database before applying
the request display-code migration.

## Student request workflow

Student registration accepts only a university email address and password. The
email prefix before `@` is matched to the Registrar-provided student directory;
the matched roster record supplies the student's ID, name, and birthdate.
Students can add contact phone and address information in Settings.

Students must submit a clearance copy and wait for Registrar verification before
creating an online request or having staff enter a walk-in request. The Registrar
confirms submitted requests, then the student pays cash at the Finance Office.
Online payments are not accepted. Students may upload a picture of the printed
request showing its tracking code and a picture of the receipt (PNG, JPEG, or
WebP, up to 2.5 MB each), or show the physical receipt directly to the
Registrar. The Registrar verifies payment, starts document processing, marks
the request ready for pickup, and records pickup as completion. Completed
requests are removed from the Registrar's active queue and remain visible in
the student's dashboard history. Walk-in requests entered by Registrar staff
use the same request and status flow.

Configure SMTP settings above for account-confirmation, comment, payment
confirmation, and pickup emails; failed deliveries are logged by the API.

Demo accounts use the local `SEED_TEST_PASSWORD` value in `server/.env`. Never
put the seed password or other credentials in this README or commit them.
