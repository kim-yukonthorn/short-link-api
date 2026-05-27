# Short Link API

Open source URL shortener REST API built with [NestJS](https://nestjs.com) and [Prisma](https://www.prisma.io). Designed as a learning playground for **building AI agents with intent classification** — pair this API with an LLM and you have a natural-language link manager.

> Sister project: see [ASSIGNMENT.md](./ASSIGNMENT.md) for the AI agent assignment that consumes this API.

---

## Features

- **Create, list, read, update, delete** short links
- **302 redirect** at `/r/:slug` with async click tracking
- **Per-link analytics** — totals, unique visitors, time series, top referrers/countries, device breakdown
- **Account-wide stats** — summary, top performers, expiring links, tag usage
- **Auto-generated Swagger docs** at `/api/docs`
- **Seeded demo data** — 25 links, ~900 clicks across 30 days, so analytics endpoints return realistic results out of the box

---

## Quick start

```bash
git clone <repo-url> short-link-api
cd short-link-api
npm install
cp .env.example .env             # or just keep the default DATABASE_URL=file:./dev.db
npm run db:migrate               # creates SQLite DB + applies schema
npm run db:seed                  # 25 links + ~900 clicks
npm run start:dev                # http://localhost:3000
```

Then open:
- **Swagger UI** → http://localhost:3000/api/docs
- **Try a redirect** → http://localhost:3000/r/google

Need a different port? `PORT=3030 npm run start:dev`

---

## Project structure

```
src/
├── prisma/             # PrismaService (DB client wrapper)
├── links/              # CRUD on links (POST/GET/PATCH/DELETE)
├── redirect/           # GET /r/:slug → 302 + click tracking
├── analytics/          # /links/:slug/analytics + /clicks
└── stats/              # /stats/*, /tags, /links/expiring
prisma/
├── schema.prisma       # Link + Click models (SQLite)
└── seed.ts             # demo data generator
```

---

## Endpoints

Base URL: `http://localhost:3000`

### Links — CRUD

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/links` | Create a short link (auto-generates slug if omitted) |
| `GET` | `/links` | List with filters: `tag`, `status`, `search`, `from`, `to`, `sort`, `order`, `page`, `limit` |
| `GET` | `/links/:slug` | Get one link with click totals |
| `PATCH` | `/links/:slug` | Update destination, title, tags, expiresAt (slug is immutable) |
| `DELETE` | `/links/:slug` | Delete link and all its clicks |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/links/:slug/analytics` | Aggregated stats: clicks-by-day, top referrers, countries, device breakdown |
| `GET` | `/links/:slug/clicks` | Raw click events, paginated (newest first) |

### Stats & discovery

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/stats/summary` | Account totals: links, clicks, last-7-day clicks, top tag |
| `GET` | `/stats/top` | Top performing links (`metric=clicks\|recent`, `period=7d\|30d\|all`, `limit`) |
| `GET` | `/links/expiring` | Links expiring soon (`within=7d`, `30d`, etc.) |
| `GET` | `/tags` | All tags with usage count |

### Redirect

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/r/:slug` | 302 redirect to destination; records click; 410 if expired; 404 if not found |

---

## Example requests

### Create a link

```bash
curl -X POST http://localhost:3000/links \
  -H 'Content-Type: application/json' \
  -d '{
    "destination": "https://www.anthropic.com",
    "slug": "claude",
    "title": "Anthropic",
    "tags": ["ai", "docs"]
  }'
```

```json
{
  "id": "cmpnm...",
  "slug": "claude",
  "destination": "https://www.anthropic.com",
  "title": "Anthropic",
  "tags": ["ai", "docs"],
  "status": "active",
  "shortUrl": "http://localhost:3000/r/claude",
  "createdAt": "2026-05-27T05:24:23.886Z"
}
```

### List links filtered by tag

```bash
curl 'http://localhost:3000/links?tag=marketing&status=active&limit=5'
```

### Get a link with totals

```bash
curl http://localhost:3000/links/google
```

### Analytics for one link

```bash
curl http://localhost:3000/links/google/analytics
```

```json
{
  "totalClicks": 90,
  "uniqueClicks": 5,
  "clicksByDay": [{"date": "2026-05-25", "count": 12}],
  "topReferrers": [{"referrer": "twitter.com", "count": 45}],
  "topCountries": [{"country": "TH", "count": 80}],
  "deviceBreakdown": {"mobile": 36, "desktop": 30, "tablet": 24}
}
```

### Account summary

```bash
curl http://localhost:3000/stats/summary
```

### Top 5 links by clicks (last 7 days)

```bash
curl 'http://localhost:3000/stats/top?metric=clicks&period=7d&limit=5'
```

### Links expiring within 7 days

```bash
curl 'http://localhost:3000/links/expiring?within=7d'
```

### Update a link

```bash
curl -X PATCH http://localhost:3000/links/claude \
  -H 'Content-Type: application/json' \
  -d '{"title": "Anthropic — updated"}'
```

### Delete a link

```bash
curl -X DELETE http://localhost:3000/links/claude
```

### Follow a redirect

```bash
curl -I http://localhost:3000/r/google
# HTTP/1.1 302 Found
# Location: https://www.google.com
```

A REST Client `.http` file with all of the above is included at [`requests.http`](./requests.http).

---

## Query parameter cheatsheet

### `GET /links`

| Param | Type | Description |
|-------|------|-------------|
| `tag` | string | Exact tag match |
| `status` | `active` \| `expired` \| `all` | Default: `all` |
| `search` | string | Matches slug, title, destination |
| `from` | ISO date | `createdAt >= from` |
| `to` | ISO date | `createdAt <= to` |
| `sort` | `createdAt` \| `clicks` | Default: `createdAt` |
| `order` | `asc` \| `desc` | Default: `desc` |
| `page` | int >= 1 | Default: 1 |
| `limit` | int 1-100 | Default: 20 |

### `GET /stats/top`

| Param | Type | Default |
|-------|------|---------|
| `metric` | `clicks` \| `recent` | `clicks` |
| `period` | `7d` \| `30d` \| `all` | `all` |
| `limit` | int 1-50 | 5 |

### `GET /links/expiring`

| Param | Type | Default |
|-------|------|---------|
| `within` | duration string (e.g. `7d`, `30d`) | `7d` |

---

## Data model

```prisma
model Link {
  id          String    @id @default(cuid())
  slug        String    @unique
  destination String
  title       String?
  tags        String    @default("[]")    // JSON-encoded array
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  clicks      Click[]
}

model Click {
  id        String   @id @default(cuid())
  linkId    String
  timestamp DateTime @default(now())
  referrer  String?
  country   String?
  device    String?  // "mobile" | "desktop" | "tablet"
  userAgent String?
}
```

> SQLite has no native array type. Tags are stored as a JSON string and parsed in the service layer. Country is derived from IP with a stable mock (no GeoIP lookup is performed).

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Start in watch mode |
| `npm run start:prod` | Build + run compiled output |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Reset + reseed demo data |
| `npm run db:reset` | Drop, recreate, migrate, reseed |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run test` | Run unit tests |

---

## Deploying

The app is a standard NestJS server with a SQLite database file. Any of these work:

### Railway / Render / Fly.io

1. Push the repo to GitHub.
2. Create a new service pointing at the repo.
3. Build command: `npm install && npm run build && npx prisma migrate deploy`
4. Start command: `node dist/main`
5. Add env var `DATABASE_URL=file:./dev.db` (or swap to a hosted Postgres — see below).
6. Optional: run the compiled seed script once to seed demo data.

### Switching to PostgreSQL

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Change the `tags String` field to `tags String[]` (Postgres supports native arrays) and remove the `JSON.parse`/`JSON.stringify` calls in `links.service.ts`, `stats.service.ts`, and `seed.ts`.

---

## License

MIT
