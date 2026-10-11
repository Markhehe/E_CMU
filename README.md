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
provider's SMTP credentials so the API can deliver account-confirmation codes.
Back up an existing database before applying pending migrations, then run:

```sh
npm run migrate
npm run seed
npm run dev
```

The seed command adds 5 demo requesters, one account for each admin role, and
30 demo requests. All demo accounts use the `SEED_TEST_PASSWORD` from
`server/.env` when first created. The seed is safe to rerun: it does not
overwrite existing accounts or create duplicate demo requests.

The API defaults to `http://localhost:5000`; the frontend defaults to
`http://localhost:5173`. The frontend signs in through the API and loads the
document catalog and requests from PostgreSQL. To use another API URL, set
`VITE_API_URL` in the frontend environment.

New requester accounts must confirm their university email address using the
six-digit code sent during registration before they can sign in. Codes expire
after 120 seconds and are invalidated after five incorrect attempts. Users can
request a new code from the sign-in screen.
Existing accounts remain verified when the email-verification migration is
applied.

Requests display a unique six-character hexadecimal code. Their UUID remains
the internal database and API identifier. Back up the database before applying
the request display-code migration.

Demo accounts use the local `SEED_TEST_PASSWORD` value in `server/.env`. Never
put the seed password or other credentials in this README or commit them.

