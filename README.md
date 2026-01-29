# Family App

A family productivity platform built with React, TypeScript, and Supabase.

## Project Structure

```
family-app/
├── apps/
│   ├── web/          # React frontend (Vite + MUI)
│   └── api/          # Backend API (Fastify + Prisma)
├── packages/
│   └── shared/       # Shared types and utilities
└── package.json      # Root workspace config
```

## Prerequisites

- **Node.js >= 22**
- **pnpm** (managed via Corepack)

Enable Corepack:
```bash
corepack enable
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start web app (default)
pnpm dev

# Or start specific apps
pnpm dev:web    # Web frontend on http://localhost:8081
pnpm dev:api    # API server on http://localhost:3001
```

## Environment Variables

### Web App (`apps/web/.env`)

Copy from `.env.example` and fill in your values:

```bash
cd apps/web
cp .env.example .env
```

#### Required for Auth (Supabase + Google OAuth)

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `VITE_SUPABASE_URL` | Supabase project URL | [Supabase Dashboard → Settings → API](https://supabase.com/dashboard/project/_/settings/api) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Same as above |

#### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APP_URL` | App base URL | `window.location.origin` |
| `VITE_AUTH_REDIRECT_PATH` | Post-login redirect | `/family` |
| `VITE_API_BASE_URL` | Backend API URL | — |

### Example `.env`

```dotenv
# Supabase Auth
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional
VITE_APP_URL=http://localhost:8081
VITE_AUTH_REDIRECT_PATH=/family
VITE_API_BASE_URL=http://localhost:3001
```

---

## Supabase + Google OAuth Setup

### 1. Supabase Dashboard Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → **Authentication** → **Providers**
3. Enable **Google** provider
4. Add your Google OAuth credentials (see step 2)
5. Go to **URL Configuration** and add redirect URLs:

| Environment | Redirect URL |
|-------------|--------------|
| Local dev | `http://localhost:8081/auth/supabase/callback` |
| Production | `https://your-domain.com/auth/supabase/callback` |

### 2. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create or select a project
3. Go to **APIs & Services** → **Credentials**
4. Create **OAuth 2.0 Client ID** (Web application)
5. Add **Authorized redirect URIs**:

```
https://<your-supabase-project>.supabase.co/auth/v1/callback
```

6. Copy **Client ID** and **Client Secret** to Supabase Google provider settings

### 3. Local Development URLs

| Service | URL |
|---------|-----|
| Web App | `http://localhost:8081` |
| API Server | `http://localhost:3001` |
| OAuth Callback | `http://localhost:8081/auth/supabase/callback` |

---

## Available Scripts

### Root (workspace)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web app |
| `pnpm dev:web` | Start web app |
| `pnpm dev:api` | Start API server |
| `pnpm build` | Build web app |
| `pnpm lint` | Lint web app |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Prisma Studio |

### Web App (`apps/web`)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint check |
| `pnpm lint:fix` | Auto-fix lint issues |

---

## Auth Flow

```
User clicks "Continue with Google"
    ↓
Redirect to Google OAuth
    ↓
Google authenticates user
    ↓
Redirect to /auth/supabase/callback
    ↓
Supabase processes tokens
    ↓
Redirect to /family (or returnTo)
```

### Protected Routes

- `/family/*` - Requires authentication
- `/settings` - Requires authentication

### Guest Routes (redirect if logged in)

- `/auth/supabase/sign-in` - Login page

---

## Database Management

### Prerequisites

The app uses PostgreSQL via Docker:

```bash
# Start the database
docker compose up -d
```

### Database Backup & Restore

A backup script is provided to protect your data before migrations:

```bash
# Create a backup (do this before any migration!)
./scripts/db-backup.sh backup

# List available backups
./scripts/db-backup.sh list

# Restore from a backup
./scripts/db-backup.sh restore backups/family_20260129_123456.sql
```

### Prisma Commands

| Command | Description | Data Safe? |
|---------|-------------|------------|
| `pnpm db:migrate` | Apply pending migrations | ✅ Yes |
| `pnpm db:generate` | Regenerate Prisma client | ✅ Yes |
| `pnpm db:studio` | Open Prisma Studio GUI | ✅ Yes |
| `prisma migrate dev` | Create & apply new migrations | ✅ Usually |
| `prisma db push` | Push schema changes (no migration file) | ⚠️ Mostly |
| `prisma migrate reset` | **Drop & recreate everything** | ❌ **No** |

> ⚠️ **Always run `./scripts/db-backup.sh backup` before using `prisma migrate reset` or any destructive commands!**

---

## Troubleshooting

### "Missing required Supabase environment variables"

Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `apps/web/.env`

### OAuth redirect fails

1. Check Supabase Dashboard → Authentication → URL Configuration
2. Ensure `http://localhost:8081/auth/supabase/callback` is in the allowed list
3. Check Google Cloud Console redirect URIs include your Supabase callback URL

### Infinite redirect loop

Clear browser cookies/localStorage and try again. This can happen if auth state gets corrupted.

---

## License

Private
