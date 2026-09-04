# Self-hosting Brick with Docker

This fork adds everything needed to run the open-source Brick export on a single server with
Docker Compose. The upstream repository ships without a README, without production env files,
without the frontend build scripts, and without a lockfile that covers every workspace package;
all of that is filled in here.

## What runs

| Service   | Image / target            | Role                                                        |
|-----------|---------------------------|-------------------------------------------------------------|
| `db`      | `postgres:16-alpine`      | Application database (volume `db-data`)                     |
| `server`  | `docker/Dockerfile` → `server`  | NestJS API, serves the editor client and public pages |
| `landing` | `docker/Dockerfile` → `landing` | Next.js marketing site shown to logged-out visitors on `/` |
| `proxy`   | `nginx:1.27-alpine`       | Routes between server, websocket and landing on one port    |

Only the proxy is published, on `127.0.0.1:8090` (edit `docker-compose.yml` to change it). Put a TLS-terminating
reverse proxy in front of it (the xCloud Docker stack does this for you).

## Quick start

```bash
cp .env.example .env
# edit .env: BRICK_HOST, DB_PASSWORD, JWT_SECRET are required
docker compose up -d --build
```

First start takes a while: it installs the pnpm workspace and builds the server, the editor
client, the public-page renderer and the landing site. On an empty database the server creates
the schema from the TypeORM entities and marks all migrations as applied; on later starts it runs
any pending migrations (see `docker/migrate.js`).

Create your first user through the sign-up form at `https://BRICK_HOST`.

## Configuration

See `.env.example` for every variable. The important ones:

- `BRICK_HOST` is baked into the frontend bundles at build time. Changing it requires
  `docker compose build`.
- `JWT_SECRET` signs login sessions. Rotating it logs everyone out.
- Email (Mailjet), image uploads (S3-compatible), social login (GitHub, Google) and Stripe are
  optional. Without Mailjet no email is sent, so set `SKIP_EMAIL_VERIFICATION=true` or new
  accounts can never log in; password reset is unavailable in that mode.
  Without S3 the image upload button reports that uploads are disabled.

## Limitations of the OSS export

- **Subdomain publishing** (`mypage.BRICK_HOST`) only works when `BRICK_HOST` has two labels
  (like `brick.do`). The server rejects hosts with more than three labels, so
  `mypage.brick.example.com` is turned away. It also needs a wildcard DNS record and a
  wildcard certificate on the outer proxy.
- **Custom domains** rely on the server issuing Let's Encrypt certificates itself on port 3001.
  That does not work behind a TLS-terminating proxy, so custom domains are effectively disabled.
- Stripe price IDs, analytics IDs and the Telegram bot were stripped from the export.
  Subscriptions cannot be purchased; every account runs on the default plan.
- The stack pins Node 16 because the client build (ejected CRA, webpack 5, CKEditor 5) and
  NestJS 8 target it.

## Files added by this fork

- `docker-compose.yml`, `.env.example`, `.dockerignore`, `.gitignore`
- `docker/Dockerfile` (multi-target), `docker/entrypoint.sh`, `docker/migrate.js`,
  `docker/nginx.conf.template`
- `apps/client/scripts/build.js`, `apps/public-client/scripts/build.js`,
  `apps/public-client/scripts/build.server-bundle.js` (reconstructed build runners)
- `apps/server/libs/constants/src/acmeAccountKey.ts` (missing module, now env-driven)
- `apps/server/apps/brick/src/email/templates/*.html` (the five transactional email templates
  were not exported; recreated with links to the existing confirm/reset/change-email routes)
- `pg` added to the server dependencies (the Postgres driver was never declared upstream) and a
  corrupted `@types/jsdom` patch file repaired so `pnpm install --frozen-lockfile` works
- Hard-coded secrets that were redacted upstream (JWT, email tokens, Mailjet, ACME email)
  now come from environment variables. Mailjet and the GitHub/Google OAuth strategies are
  only enabled when their credentials are set, so the server boots without them.
