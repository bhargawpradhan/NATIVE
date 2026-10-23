# MiniLedger — Personal Lending Ledger

MiniLedger is a personal lending ledger designed to track money lent to friends, monitor repayment statuses, and compute financial aggregates (total lent, total repaid, and overdue amount).

The project is structured as a decoupled monorepo containing a **Fastify + TypeScript + Prisma** backend and a **React Native + Expo SDK 52 + Expo Router** mobile application.

---

## 1. Project Implementation Status (Phase 02 Complete)

### What Is Implemented & Verified in Phase 02:
- [x] **Database & Migrations:** Real PostgreSQL database (`miniledger_db`) and isolated test database (`miniledger_test`) fully migrated via Prisma Migrate (`20261023170308_init`).
- [x] **Authentication:** Phone number OTP login (`POST /api/v1/auth/request-otp`), cryptographically secure 6-digit OTP logged to server terminal with masked phone, HMAC-SHA256 hashed challenge persistence, timing-safe verification, atomic consumption, and signed JWT Bearer tokens (`POST /api/v1/auth/verify-otp`).
- [x] **User Profile:** Authenticated profile route (`GET /api/v1/auth/me`).
- [x] **Loan Management:**
  - Create loan (`POST /api/v1/loans`) with friend name, decimal amount (`Decimal(12, 2)`), calendar due date (`@db.Date`), and optional notes.
  - List & filter loans (`GET /api/v1/loans`) with status filters (`all`, `active`, `overdue`, `repaid`), sort allowlist, pagination, and dynamic timezone-aware overdue evaluation (`Asia/Kolkata`).
  - Retrieve single loan (`GET /api/v1/loans/:id`) strictly scoped to the authenticated owner (`404 Not Found` for other users' loans).
  - Mark loan repaid (`PATCH /api/v1/loans/:id/repay`) with atomic state update, server-side timestamp, and idempotency protection (`409 Conflict` on duplicate repayment).
- [x] **Financial Summary:** Aggregated ledger summary (`GET /api/v1/summary`) computing `totalLent`, `totalRepaid`, `overdueAmount`, and `outstandingAmount` using exact arbitrary-precision arithmetic serialized as fixed two-decimal strings.
- [x] **Health Check:** Dynamic health check (`GET /health`) actively probing PostgreSQL connectivity (200 healthy / 503 degraded).
- [x] **Automated Integration Tests:** Comprehensive Vitest test suite (33 tests across 4 test suites) verifying all endpoints against the isolated test database `miniledger_test`.

### What Is Planned for Subsequent Phases:
- [ ] **Phase 03–06:** Mobile UI Screens (Native phone OTP login, Dashboard summary card, Loan list with overdue alerts, Add-loan modal form, Repay action flow).
- [ ] **Phase 07–08:** End-to-end verification, accessibility polish, and 2–3 minute demonstration video walkthrough.

---

## 2. Repository Organization

```text
D:\Native/
├── .gitignore
├── compose.yaml              # Local PostgreSQL 16 container definition
├── package.json              # Root orchestration scripts
├── package-lock.json         # Root lockfile
├── README.md                 # Project guide
├── docs/
│   ├── architecture.md       # Architectural boundaries, precision & security
│   ├── api-contract.md       # Canonical HTTP REST API contract
│   └── design-system.md      # UI design tokens and component blueprints
├── backend/                  # Fastify + TypeScript + Prisma API
│   ├── .env.example          # Backend environment template
│   ├── package.json          # Backend manifest & dependencies
│   ├── tsconfig.json         # Strict TypeScript compiler options
│   ├── vitest.config.ts      # Test runner configuration
│   ├── prisma/
│   │   └── schema.prisma     # Relational schema (User, Loan, OtpChallenge)
│   ├── src/
│   │   ├── config/           # Validated environment configuration
│   │   ├── plugins/          # CORS, error handler, Prisma plugin
│   │   ├── modules/
│   │   │   └── health/       # Health routes
│   │   ├── app.ts            # Fastify application factory
│   │   └── server.ts         # Server process entry point
│   └── tests/                # Automated integration tests
└── mobile/                   # React Native + Expo Router application
    ├── .env.example          # Mobile environment template
    ├── app.json              # Expo application manifest
    ├── package.json          # Mobile manifest & dependencies
    ├── tsconfig.json         # Mobile TypeScript configuration
    ├── src/
    │   ├── app/              # Expo Router file-based screens
    │   ├── components/       # Shared UI primitives (ScreenContainer, Badge)
    │   ├── features/         # Feature modules (auth, dashboard, loans)
    │   ├── lib/              # API client configuration
    │   ├── theme/            # Design tokens (Colors, Spacing, Typography, Radii)
    │   └── types/            # Shared client types
    └── assets/               # Application icons and static assets
```

---

## 3. Prerequisites

- **Node.js:** `v20+` or `v22+` LTS (tested on `v24.15.0`).
- **npm:** `v10+` or `v11+` (tested on `11.12.1`).
- **Docker & Docker Compose:** Docker Desktop installed and running (for local PostgreSQL container).
  *(Alternative: Local PostgreSQL 18 Windows service or external PostgreSQL URL).*
- **Expo Go (Optional):** Installed on your iOS or Android device for physical phone testing.

---

## 4. Setup & Installation

### Step 1: Install Dependencies
From the repository root `D:\Native`:

```powershell
# Install root dev dependencies (concurrently)
npm install

# Install backend dependencies
npm --prefix backend install

# Install mobile dependencies
npm --prefix mobile install
```

### Step 2: Configure Environment Variables

1. **Backend Environment:**
   Copy `backend/.env.example` to `backend/.env`:
   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```
   *Default values in `.env.example` are preconfigured for local Docker Compose development.*

2. **Mobile Environment:**
   Copy `mobile/.env.example` to `mobile/.env`:
   ```powershell
   Copy-Item mobile\.env.example mobile\.env
   ```

---

## 5. Database Infrastructure (Docker Compose & Local Fallback)

MiniLedger supports two completely distinct PostgreSQL infrastructure paths depending on your operating environment. **These environments use separate persistent storage and must not be confused with each other.**

### Path A: Standard Docker Compose (Containerized PostgreSQL 16)

Use this when Docker Desktop / Docker Engine is running on your system.

- **Engine:** PostgreSQL 16 Alpine container (`miniledger-postgres`).
- **Data Persistence:** Dedicated Docker named volume `miniledger_postgres_data` (managed by the Docker daemon).
- **Port Requirement:** `5432` on `localhost`.
- **Connection URL:**
  ```env
  DATABASE_URL="postgresql://miniledger_dev:miniledger_dev_secret@localhost:5432/miniledger_db?schema=public"
  ```
- **Lifecycle Commands:**
  ```powershell
  # Start container in detached mode
  npm run db:up         # or: docker compose up -d

  # Inspect container health (waits for pg_isready)
  npm run db:status     # or: docker compose ps

  # Stop container preserving volume data
  npm run db:down       # or: docker compose down

  # Destructive reset (removes tables and the named volume)
  docker compose down -v
  ```

---

### Path B: Local User-Space PostgreSQL 18 Fallback

Used when Docker Desktop is unavailable or the Docker daemon cannot run without elevated administrative privileges.

- **Engine:** Locally installed PostgreSQL 18 Windows binaries (`C:\Program Files\PostgreSQL\18\bin` or system `PATH`).
- **Data Persistence:** Dedicated user-space data directory at `$env:USERPROFILE\.miniledger_pgdata` on the Windows NTFS filesystem. *(Completely separate from Docker named volumes).*
- **Authentication:** Initialized with `trust` mode for local loopback; password field in connection strings is accepted without verification.
- **Port Requirement:** `5432` on `localhost`. *(Cannot run concurrently with Docker container on port 5432).*
- **Distinct Databases:**
  - **Development:** `miniledger_db`
    ```env
    DATABASE_URL="postgresql://miniledger_dev:miniledger_dev_secret@localhost:5432/miniledger_db?schema=public"
    ```
  - **Automated Tests:** `miniledger_test`
    ```env
    TEST_DATABASE_URL="postgresql://miniledger_dev:miniledger_dev_secret@localhost:5432/miniledger_test?schema=public"
    ```
- **Lifecycle Commands:**
  ```powershell
  # Start PostgreSQL in background (daemon mode)
  & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "$env:USERPROFILE\.miniledger_pgdata" -l "$env:USERPROFILE\.miniledger_pgdata\logfile" start

  # Check server status
  & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" status -D "$env:USERPROFILE\.miniledger_pgdata"

  # Stop PostgreSQL cleanly
  & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "$env:USERPROFILE\.miniledger_pgdata" stop
  ```

---

### Database Isolation & Test Safety Guard

To prevent automated test suites from ever damaging development data:
1. All automated tests in `backend/tests/` connect strictly to `TEST_DATABASE_URL` (`miniledger_test`).
2. The test harness (`backend/tests/helpers/test-db.ts`) enforces strict runtime assertion guards:
   - Refuses initialization if the connection URL does not contain `miniledger_test` or `_test`.
   - Refuses table truncation/cleanup if the connection URL does not contain `miniledger_test` or `_test`.

---

## 6. Security & Rate Limiting Architecture

MiniLedger implements multi-layered authentication protection:

1. **Per-IP Rate Limiting:** Managed via `@fastify/rate-limit` on `/api/v1/auth/request-otp` (5 requests / 10 minutes) and `/api/v1/auth/verify-otp` (10 requests / 10 minutes).
2. **PostgreSQL-Backed Per-Phone Cooldown:** Enforced in `AuthService` using the indexed `otp_challenges` table. Subsequent requests for the same normalized phone number within 60 seconds are rejected with HTTP `429 Too Many Requests`. Attackers rotating IP addresses cannot bypass this phone-level limit.
3. **Per-Phone Rolling Window Maximum:** Enforces a configurable cap of 5 OTP requests per phone number within any 10-minute rolling window (`OTP_MAX_ISSUANCE_PER_WINDOW=5`, `OTP_ISSUANCE_WINDOW_SECONDS=600`).
4. **Phone Normalization:** Phone numbers with spaces, hyphens, and formatting are canonicalized before storage and rate-limiting lookups.
5. **Generic Error Responses:** Rate-limit and authentication errors do not disclose user registration existence.
6. **Configurable JWT Lifetime:** JWT tokens are issued with a 1-hour expiration (`JWT_EXPIRES_IN="1h"`, configurable via `.env`). Expired tokens are rejected with HTTP `401 Unauthorized`.
7. **Mock OTP Dispatch:** In development, OTPs are printed prominently to the server terminal with the phone number masked (`+91 ****** 1234`). OTP values are never returned in HTTP responses.

---

## 7. Database Migrations & Prisma Client

### Generate Prisma Client
```powershell
npm --prefix backend run prisma:generate
```

### Validate Schema
```powershell
npm --prefix backend run prisma:validate
```

### Run Migrations (When PostgreSQL is running)
```powershell
npm --prefix backend run prisma:migrate:dev -- --name init
```

---

## 7. Starting the Applications

### Option A: Run Both Services Concurrently
```powershell
npm run dev
```

### Option B: Run Services Individually

**Terminal 1 — Backend API:**
```powershell
npm run dev:backend
# Starts Fastify with tsx watch on http://localhost:4000
```

**Terminal 2 — Mobile Application:**
```powershell
npm run dev:mobile
# Starts the Expo Metro bundler
```

---

## 8. Verifying the Health Endpoint

With the backend running:

```powershell
# In PowerShell:
Invoke-RestMethod -Uri http://localhost:4000/health | ConvertTo-Json
```

- When PostgreSQL is connected:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-23T15:30:00.000Z",
    "services": {
      "api": "up",
      "database": "connected"
    }
  }
  ```
- When PostgreSQL is disconnected:
  Returns HTTP `503 Service Unavailable` with `database: "disconnected"`.

---

## 9. Running Tests and Typechecks

### Backend Unit & Integration Tests (Vitest)
```powershell
npm test
# or: npm --prefix backend test
```

### Typecheck Both Backend and Mobile
```powershell
npm run typecheck
```

---

## 10. Physical Device Testing with Expo Go (LAN Configuration)

When running the mobile app on a physical iPhone or Android smartphone via the **Expo Go** app:

1. Connect your smartphone and development computer to the **same local Wi-Fi network**.
2. Find your computer's local network IP address (e.g. `192.168.1.50`) by running `ipconfig` in PowerShell.
3. Open `mobile/.env` and configure:
   ```env
   EXPO_PUBLIC_API_URL="http://192.168.1.50:4000"
   ```
4. Start the Expo bundler:
   ```powershell
   npm run dev:mobile
   ```
5. Scan the terminal QR code with your phone camera (iOS) or the Expo Go app (Android).
