# Deployment Guide

## 1. Local / demo (SQLite)

```powershell
copy .env.example .env
npx.cmd prisma db push
npm.cmd run db:seed
npm.cmd run build
npm.cmd start          # http://localhost:3000
```

SQLite file lives at `prisma/dev.db` — fine for demos and single-instance trials.

---

## 2. Production (PostgreSQL)

### 2.1 Switch the provider

1. `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/africinnovate?schema=public"
   AUTH_SECRET="<64+ random chars: openssl rand -hex 32>"
   ```
   The schema contains **no** SQLite-only types — the same file works unchanged.
3. Push and seed:
   ```powershell
   npx.cmd prisma db push
   npm.cmd run db:seed
   ```
   For repeatable environments use the checked-in migration history:
   ```powershell
   npx.cmd prisma migrate dev --name init
   # in CI/CD: npx prisma migrate deploy
   ```

### 2.2 Build & run

```powershell
npm.cmd ci
npx.cmd prisma generate
npx.cmd prisma migrate deploy   # or db push for greenfield
npm.cmd run db:seed             # first deploy only
npm.cmd run build
npm.cmd start
```

`next build` requires `DATABASE_URL` at build time only if pages are statically
pre-rendered; all DB-backed pages here are `dynamic = "force-dynamic"`, so builds
succeed without touching the database.

---

## 3. Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | SQLite file path or Postgres DSN |
| `AUTH_SECRET` | **yes (prod)** | JWT signing key; without it a dev fallback is used — never ship that |
| `AI_SCORING_API_KEY` | no | Enables advisory AI rubric suggestions; use an approved OpenAI-compatible provider and review its data-processing terms |
| `AI_SCORING_API_URL` / `AI_SCORING_MODEL` | no | Provider endpoint and model configuration |
| `EMAIL_PROVIDER_API_KEY` | no | Enables optional candidate completion/profile emails via the Resend-compatible adapter |
| `EMAIL_PROVIDER_URL` | no | Email provider endpoint override |
| `EMAIL_FROM` | with email | Verified sender address |

Set both in your host's environment (Vercel / Railway / Render / Docker).

---

## 4. Hardening checklist (before going live)

- [ ] `AUTH_SECRET` set to a long random value
- [ ] AI provider configured only if candidate-response data is approved for that provider
- [ ] Email sender/domain verified if completion emails are enabled
- [ ] Seeded accounts: change `Admin123!` / `Admissions123!` / `Instructor123!`
      or delete the demo users
- [ ] Seed link token `tech-aptitude-1` replaced/`PAUSED` if not intended public
- [ ] HTTPS terminated at the proxy; `Secure` cookie behaviour verified
- [ ] Rate limiting upgraded for multi-instance (in-memory limiter is per-process —
      use Redis/Upstash if you scale horizontally)
- [ ] Daily database backups (Postgres `pg_dump` / managed snapshots)
- [ ] Log shipping for `AuditLog` (or export to your SIEM)
- [ ] `next start` behind a process manager (pm2 / systemd / container restart policy)

---

## 5. Docker (example)

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

Build args need `DATABASE_URL` + `AUTH_SECRET` at runtime (and build for `prisma generate`).

---

## 6. Verifying a deployment

1. `/` renders the landing page.
2. `/a/<token>` shows the intro form; register → answer a few → resume works.
3. Submit → `/report/<token>` shows the profile report.
4. `/admin` login with a staff account → dashboard loads stats.
5. Candidates list shows the attempt; CSV export downloads.
6. `GET /api/auth/me` returns `401` with no cookie; `/api/admin/*` returns `401`.
7. Attempt a `PATCH /api/admin/questions/<id>` on a published version → `409 VERSION_IMMUTABLE`.
