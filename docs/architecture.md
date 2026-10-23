# MiniLedger — System Architecture Blueprint

## 1. System Overview

MiniLedger is a personal lending ledger designed to track money lent to friends, monitor repayment statuses, and surface financial summaries (total lent, total repaid, overdue amount).

The application follows a decoupled client-server architecture:
- **Mobile Client (`mobile/`)**: Cross-platform React Native mobile application built on Expo SDK with Expo Router, TypeScript, and a fintech-grade design system.
- **Backend API (`backend/`)**: High-performance Node.js service using Fastify, strict TypeScript, Prisma ORM, and schema-driven request validation.
- **Persistence Layer**: PostgreSQL database running locally via Docker Compose or a managed PostgreSQL instance, with schema migrations managed via Prisma.

```
┌────────────────────────────────────────────────────────┐
│            Mobile Application (Expo / React Native)    │
│  - Expo Router (Navigation)                            │
│  - Design System & Tokens (Colors, Typography, Motion) │
│  - API Client (Bearer Token Auth Interceptor)          │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST (JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Backend Service (Fastify / Node.js)      │
│  - Application Factory Pattern (src/app.ts)            │
│  - Centralized Error & Response Envelope               │
│  - Fastify Plugins: CORS, Prisma, JWT, Rate-Limiting   │
│  - Modules: Auth (OTP), Loans, Summary, Health         │
└───────────────────────────┬────────────────────────────┘
                            │ Prisma Client (SQL)
                            ▼
┌────────────────────────────────────────────────────────┐
│               PostgreSQL Database                      │
│  - Users, Loans, OtpChallenges                         │
│  - Fixed-precision Decimals for Currency               │
│  - Calendar-date type for Due Dates                    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Dependency Boundaries & Folder Layout

The repository is organized as two independent applications under a single Git root:

```text
D:\Native/
├── .gitignore
├── compose.yaml              # Local PostgreSQL container specification
├── package.json              # Root coordination scripts
├── package-lock.json
├── docs/
│   ├── architecture.md       # System architecture, boundaries, lifecycle
│   ├── api-contract.md       # Canonical HTTP API specification
│   └── design-system.md      # UI design tokens and component guidelines
├── backend/                  # Fastify + TypeScript + Prisma
│   ├── prisma/
│   │   └── schema.prisma     # Relational data models
│   ├── src/
│   │   ├── config/           # Validated environment configuration
│   │   ├── plugins/          # Fastify plugins (CORS, Prisma, Error Handler)
│   │   ├── modules/
│   │   │   ├── auth/         # Phone OTP request & verification
│   │   │   ├── loans/        # Loan CRUD & Repayment logic
│   │   │   ├── summary/      # Financial aggregate computations
│   │   │   └── health/       # Liveness & readiness reporting
│   │   ├── app.ts            # Fastify application factory
│   │   └── server.ts         # Runtime entry point (binds to host:port)
│   └── tests/                # Vitest integration & unit tests
└── mobile/                   # Expo + React Native + TypeScript
    ├── app/                  # Expo Router file-based route tree
    ├── src/
    │   ├── api/              # HTTP client and endpoints
    │   ├── components/       # Primitive & shared UI components
    │   ├── features/         # Feature-specific state and views
    │   └── theme/            # Design tokens (colors, spacing, typography)
    └── assets/               # Icons and brand assets
```

### Decoupling Rules
1. **Isolated Manifests:** `backend/` and `mobile/` maintain separate `package.json` and `package-lock.json` manifests. Backend dependencies (e.g. Fastify, Prisma) never mix with mobile dependencies (e.g. React Native, Expo).
2. **Zero Runtime Leaks:** The mobile client consumes the backend exclusively through the documented REST API over HTTP/JSON.
3. **Application Factory Pattern:** `backend/src/app.ts` exports `buildApp()`, allowing test suites to inject HTTP requests via `app.inject()` without binding to network ports. `backend/src/server.ts` solely handles process lifecycle and network binding.

---

## 3. Data Integrity & Financial Precision Decisions

### A. Fixed-Precision Decimal Amounts
Binary floating-point arithmetic (`0.1 + 0.2 = 0.30000000000000004`) causes unacceptable round-off discrepancies in financial software.
- In PostgreSQL, loan amounts are stored as `Decimal(12, 2)` (supporting amounts up to \$9,999,999,999.99 with exact cent precision).
- In the REST API, amounts are serialized as fixed numeric strings or explicit numbers with two decimal places (e.g. `150.00`).
- Calculations for sums (`totalLent`, `totalRepaid`, `overdueAmount`, `outstandingAmount`) use decimal aggregations in SQL or Prisma Decimal wrappers.

### B. Calendar-Date Preservation for Due Dates
Due dates represent specific calendar days (e.g. "November 15, 2026") rather than specific UTC instants:
- In PostgreSQL, due dates are stored using the calendar `@db.Date` type (YYYY-MM-DD), avoiding timezone shifts where midnight UTC becomes the previous evening in local time zones.
- API inputs enforce `YYYY-MM-DD` or full ISO8601 strings truncated to date-only.

### C. Dynamic Overdue Derivation
A loan is overdue if:
$$\text{isRepaid} = \text{false} \quad \text{AND} \quad \text{dueDate} < \text{currentDate}$$
The overdue status is **derived at query time** rather than stored as a static enum in the database. Storing overdue as static state results in stale data when midnight passes without an active cron or background worker.

---

## 4. Security & Environment Configuration

### A. Authentication & Mock OTP
1. **Request OTP (`POST /api/v1/auth/request-otp`):** User submits their phone number. A 6-digit cryptographic OTP is generated, hashed with a keyed HMAC-SHA256 using `OTP_HASH_SECRET` before database persistence in `OtpChallenge`, and printed to backend standard output (`stdout`) for development testing (with masked phone number).
   - **Development / Assessment Note:** This mock-OTP dispatch is strictly an assessment/development authentication mechanism. In production, this would be replaced with an external SMS gateway (e.g. Twilio, AWS SNS, Karix) with webhook delivery callbacks.
   - **Concurrency & Serialization:** Enforced via PostgreSQL transaction-level advisory locks (`pg_advisory_xact_lock(4201, hashtext(phone))`) inside a database transaction. Serializes concurrent requests for the same phone number to guarantee atomic execution of:
     - 60-second cooldown check
     - 10-minute rolling window limit check (max 5 requests)
     - Invalidation of prior active challenges
     - Insertion of the new OTP challenge
   - Different phone numbers lock on distinct keys and execute fully concurrently.
2. **Verify OTP (`POST /api/v1/auth/verify-otp`):** User submits the OTP. The backend computes the HMAC hash, verifies it against the active unexpired challenge using `crypto.timingSafeEqual`, increments attempts on failure (enforcing a maximum 5 failed attempts limit), and atomically marks the challenge consumed via a conditional database update (`consumedAt: null`). Upon successful verification, a signed JWT Bearer token is issued with a 1-hour expiration lifetime (configurable via `JWT_EXPIRES_IN`).
3. **Row-Level User Isolation:** Every loan belongs to a specific `userId`. All loan queries, updates, and summary calculations are strictly scoped by `userId` extracted from the verified JWT. An attempt to access another user's loan returns `404 Not Found` to prevent resource enumeration.

---

## 5. Timezone & Overdue Determination Policy

- The application uses `APP_TIME_ZONE` (defaulting to `Asia/Kolkata`) to determine the current calendar day (`YYYY-MM-DD`).
- A loan is classified as `OVERDUE` if:
  $$\text{repaidAt} = \text{null} \quad \text{AND} \quad \text{dueDate} < \text{currentDate}_{\text{timezone}}$$
- A loan due on today's calendar date is classified as `ACTIVE` and is not overdue until the clock passes midnight in the configured timezone.
- Once a loan is marked repaid, it is permanently classified as `REPAID`, and its amount is excluded from `overdueAmount`. Duplicate repayment attempts are rejected with `409 Conflict`.

### B. Environment Isolation
- Real environment variables (`.env`) are never committed to version control.
- Clear `.env.example` templates define required configuration with local-only defaults.
- For physical mobile device testing via Expo Go, the mobile client connects to the computer's LAN IP address (e.g. `http://192.168.1.X:4000`) rather than `localhost`.
