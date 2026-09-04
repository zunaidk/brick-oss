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
- `SELF_HOSTED_PLAN` (default true) puts every account on an unlimited, free "Self-hosted" plan:
  private pages, custom fonts, unlimited workspaces, subdomains and collaborators, no upgrade
  prompts. Existing Free accounts are moved over on the next start.
- `ALLOW_SIGNUP=false` closes registration once your own account exists. Existing accounts keep
  working; new local or social sign-ups get a 403.
- `JWT_SECRET` signs login sessions. Rotating it logs everyone out.
- Email (Mailjet), image uploads (S3-compatible), social login (GitHub, Google) and Stripe are
  optional. Without Mailjet no email is sent, so set `SKIP_EMAIL_VERIFICATION=true` or new
  accounts can never log in; password reset is unavailable in that mode.
  Without S3 the image upload button reports that uploads are disabled.

## Public pages on `page.<BRICK_HOST>`

Brick serves published pages from `page.<BRICK_HOST>`, so that hostname needs a DNS record and
must reach the same stack. If your platform can attach it as an alias of the main site, do that.
xCloud can only *redirect* additional domains, so instead deploy `docker-compose.pagehost.yml`
as a second site (same repository, compose file `docker-compose.pagehost.yml`, port 8091,
primary domain `page.<BRICK_HOST>`) after the main stack is running. It is a one-container
nginx that joins the main stack's `brick_net` network and forwards everything to its proxy.

## Custom domains for published pages

Users can attach their own domain to a page. Upstream, Brick obtained Let's Encrypt certificates
itself on port 3001. Behind a TLS-terminating proxy that is impossible, so with
`EXTERNAL_TLS_TERMINATION=true` (the default) Brick just records the domain and the proxy must
route it. On xCloud, for each custom domain: point its DNS at the server, then deploy
`docker-compose.extra-domain.yml` (port 8092) as another Git site with that domain as primary.
Every domain needs its own host port, so further domains use `docker-compose.extra-domain-8093.yml`,
`-8094`, `-8095`, `-8096` (copy one and change the port if you need more).

## Migrating from brick.do

brick.do has no self-service export, but everything a logged-in user owns is readable through the
same API the editor uses. The migration is: export in the browser, download images, import into
this instance's database with `docker/import-brick-export.js`.

1. **Export.** Log in to brick.do in Chrome, open DevTools on any brick.do tab and run a script that
   fetches `/api/workspace`, `/api/workspace/<id>/pages`, `/api/page/<id>/content|styles|head-tags`
   for every page and `/api/public-address`, then saves the result as a JSON download with the shape
   `{profile, workspace, pagesTree, publicAddresses, themes, pages:{<id>:{content,styles,headTags}}}`.
2. **Images.** Collect every `https://cdn-images.brick.do/...` URL in the exported content (including
   `srcset` variants), download them and write `manifest.json` mapping URL -> local filename.
3. **Copy to the server.** Put the images in the `uploads` volume under `migrated/` so the proxy
   serves them at `https://BRICK_HOST/uploads/migrated/<file>`:
   ```bash
   V=$(docker volume ls -q | grep _uploads)          # the compose project's uploads volume
   docker run --rm -v $V:/u -v $PWD:/src alpine sh -c 'mkdir -p /u/migrated && cp /src/images/* /u/migrated/'
   ```
4. **Import.** Sign up on the new instance first, then from the site directory:
   ```bash
   docker compose cp export.json server:/tmp/export.json
   docker compose cp images/manifest.json server:/tmp/manifest.json
   docker compose exec server node docker/import-brick-export.js /tmp/export.json \
     --user you@example.com \
     --images-base https://BRICK_HOST/uploads/migrated --images-manifest /tmp/manifest.json \
     --domains docs.example.com,other.example.com      # custom domains to keep; or --no-domains
   ```
   Page IDs, short IDs, slugs and ordering are preserved; re-running skips existing pages.
5. **Route each kept custom domain** to the stack (see "Custom domains for published pages") and
   move its DNS.

## Limitations of the OSS export

- **Subdomain publishing** (`mypage.BRICK_HOST`) only works when `BRICK_HOST` has two labels
  (like `brick.do`). The server rejects hosts with more than three labels, so
  `mypage.brick.example.com` is turned away. It also needs a wildcard DNS record and a
  wildcard certificate on the outer proxy.
- **Custom domains** need a proxy route per domain (see above); Brick cannot issue certificates
  behind a TLS-terminating proxy.
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
