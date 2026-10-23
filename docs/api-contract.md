# MiniLedger — HTTP API Specification & Contract

## 1. Global Conventions

### Base URL & Versioning
All API endpoints are versioned under the `/api/v1` prefix, with the exception of the root health check `/health`.

- Development Local Base URL: `http://localhost:4000`
- Mobile LAN Base URL: `http://<LAN_IP>:4000` (e.g. `http://192.168.1.50:4000`)

### Authentication & Authorization
- Protected endpoints require a Bearer token in the HTTP Authorization header:
  ```http
  Authorization: Bearer <jwt_access_token>
  ```
- Unauthenticated requests to protected endpoints return `401 Unauthorized`.
- Requests attempting to read or modify resources belonging to another user return `404 Not Found` (to prevent ID enumeration attacks).

### Error Response Envelope
All error responses adhere to a uniform JSON structure:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Human-readable description of the error",
  "details": [
    {
      "field": "amount",
      "issue": "Must be greater than 0"
    }
  ]
}
```

### Standard HTTP Status Codes
- `200 OK`: Request succeeded, returns response body.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Input validation failed or business rule violation.
- `401 Unauthorized`: Missing or invalid Bearer token.
- `404 Not Found`: Resource does not exist or does not belong to the user.
- `409 Conflict`: Conflict with current resource state.
- `429 Too Many Requests`: Rate limit exceeded (e.g. OTP brute-force protection).
- `500 Internal Server Error`: Unhandled server exception.
- `503 Service Unavailable`: Dependent service (e.g. Database) unreachable.

---

## 2. Implementation Status Summary

| Method | Route | Planned Phase | Current Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Phase 01 | **IMPLEMENTED & VERIFIED** |
| `POST` | `/api/v1/auth/request-otp` | Phase 02 | **IMPLEMENTED & VERIFIED** |
| `POST` | `/api/v1/auth/verify-otp` | Phase 02 | **IMPLEMENTED & VERIFIED** |
| `GET` | `/api/v1/auth/me` | Phase 02 | **IMPLEMENTED & VERIFIED** |
| `POST` | `/api/v1/loans` | Phase 02 | **IMPLEMENTED & VERIFIED** |
| `GET` | `/api/v1/loans` | Phase 02 | **IMPLEMENTED & VERIFIED** |
| `GET` | `/api/v1/loans/:id` | Phase 02 | **IMPLEMENTED & VERIFIED** |
| `PATCH`| `/api/v1/loans/:id/repay` | Phase 02 | **IMPLEMENTED & VERIFIED** |
| `GET` | `/api/v1/summary` | Phase 02 | **IMPLEMENTED & VERIFIED** |

---

## 3. Detailed Endpoint Contracts

### 3.1 Health & Readiness
#### `GET /health`
- **Purpose:** Verifies whether the Fastify service is live and checks connectivity to PostgreSQL.
- **Auth:** Public.
- **Request Parameters:** None.
- **Success Response (`200 OK`):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-23T15:00:00.000Z",
    "services": {
      "api": "up",
      "database": "connected"
    }
  }
  ```
- **Degraded Response (`503 Service Unavailable`):**
  *(Returned when the Fastify web server is running, but the database connection fails or is stopped).*
  ```json
  {
    "status": "degraded",
    "timestamp": "2026-10-23T15:00:00.000Z",
    "services": {
      "api": "up",
      "database": "disconnected"
    },
    "error": "Database connectivity check failed"
  }
  ```

---

### 3.2 Authentication Endpoints

#### `POST /api/v1/auth/request-otp`
- **Purpose:** Initiates login for a given phone number. Generates a 6-digit mock OTP, persists a hashed challenge record, and logs the OTP prominently to backend `stdout`.
- **Auth:** Public.
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "phone": "+14155552671"
  }
  ```
- **Validation Rules:**
  - `phone`: String, required. Must be valid E.164 format or 10-15 digit phone string.
- **Security Rule:** **The OTP code is NEVER returned in the HTTP response.** It is printed strictly to the backend terminal log.
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "OTP sent to server terminal log",
    "expiresInSeconds": 300
  }
  ```
- **Terminal Log Output:**
  ```text
  ======================================================
  [MOCK OTP DISPATCH]
  Phone: +14155552671
  OTP: 739201
  Expires: 5 minutes
  ======================================================
  ```
- **Error Cases:**
  - `400 Bad Request`: Invalid phone format (`{"statusCode": 400, "message": "Invalid phone number format"}`).
  - `429 Too Many Requests`:
    - *Phone Cooldown Limit:* Request OTP called within 60 seconds for the same normalized phone number (`{"statusCode": 429, "error": "Too Many Requests", "message": "Too many requests. Please try again in 58 seconds."}`).
    - *Phone Rolling Window Limit:* More than 5 OTP requests for the same phone within 10 minutes (`{"statusCode": 429, "error": "Too Many Requests", "message": "Too many requests. Please try again later."}`).
    - *IP-Level Rate Limit:* More than 5 OTP requests from the same IP address within 10 minutes (`{"statusCode": 429, "error": "Too Many Requests", "message": "Rate limit exceeded. Try again in 600 seconds."}`).

---

#### `POST /api/v1/auth/verify-otp`
- **Purpose:** Verifies the submitted OTP against the active challenge for the phone number. Creates the user record if new, and issues a signed JWT Bearer token valid for 1 hour (configurable via `JWT_EXPIRES_IN`).
- **Auth:** Public.
- **Request Body:**
  ```json
  {
    "phone": "+14155552671",
    "otp": "739201"
  }
  ```
- **Validation Rules:**
  - `phone`: String, required.
  - `otp`: String, required, exactly 6 numeric digits.
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_01HXYZ123456789",
      "phone": "+14155552671",
      "createdAt": "2026-10-23T15:00:00.000Z"
    }
  }
  ```
- **Error Cases:**
  - `400 Bad Request`: OTP incorrect, expired, or challenge already consumed.
  - `429 Too Many Requests`: Maximum 3 failed OTP verification attempts exceeded; challenge invalidated.

---

#### `GET /api/v1/auth/me`
- **Purpose:** Retrieves the current authenticated user's profile.
- **Auth:** Required (`Bearer`).
- **Success Response (`200 OK`):**
  ```json
  {
    "user": {
      "id": "usr_01HXYZ123456789",
      "phone": "+14155552671",
      "createdAt": "2026-10-23T15:00:00.000Z"
    }
  }
  ```
- **Error Cases:**
  - `401 Unauthorized`: Token missing or expired.

---

### 3.3 Loan Management Endpoints

#### `POST /api/v1/loans`
- **Purpose:** Records a new money loan granted to a friend.
- **Auth:** Required (`Bearer`).
- **Request Body:**
  ```json
  {
    "friendName": "Sarah Jenkins",
    "amount": 250.00,
    "dueDate": "2026-11-20",
    "notes": "Concert ticket and dinner"
  }
  ```
- **Validation Rules:**
  - `friendName`: String, required, 1 to 100 characters. Trimmed.
  - `amount`: Number, required, strictly positive (`> 0`), maximum 2 decimal places. Max limit: `10000000.00`.
  - `dueDate`: String, required, valid calendar date formatted as `YYYY-MM-DD` or ISO string. Must not be empty.
  - `notes`: String, optional, max 500 characters.
- **Success Response (`201 Created`):**
  ```json
  {
    "loan": {
      "id": "loan_01HABC987654321",
      "friendName": "Sarah Jenkins",
      "amount": "250.00",
      "dueDate": "2026-11-20",
      "isRepaid": false,
      "repaidAt": null,
      "isOverdue": false,
      "notes": "Concert ticket and dinner",
      "createdAt": "2026-10-23T15:05:00.000Z",
      "updatedAt": "2026-10-23T15:05:00.000Z"
    }
  }
  ```
- **Error Cases:**
  - `400 Bad Request`: Negative amount, missing friend name, or invalid date.
  - `401 Unauthorized`: Missing or invalid Bearer token.

---

#### `GET /api/v1/loans`
- **Purpose:** Lists loans belonging to the authenticated user with optional filtering and sorting.
- **Auth:** Required (`Bearer`).
- **Query Parameters:**
  - `status`: Optional string enum: `all` (default), `active`, `overdue`, `repaid`.
  - `sort`: Optional string enum: `dueDate` (default), `amount`, `createdAt`.
  - `order`: Optional string enum: `asc` (default), `desc`.
  - `limit`: Optional integer, default `50`, max `100`.
  - `offset`: Optional integer, default `0`.
- **Success Response (`200 OK`):**
  ```json
  {
    "loans": [
      {
        "id": "loan_01HABC987654321",
        "friendName": "Sarah Jenkins",
        "amount": "250.00",
        "dueDate": "2026-11-20",
        "isRepaid": false,
        "repaidAt": null,
        "isOverdue": false,
        "notes": "Concert ticket and dinner",
        "createdAt": "2026-10-23T15:05:00.000Z"
      },
      {
        "id": "loan_01HABC111222333",
        "friendName": "David Miller",
        "amount": "120.00",
        "dueDate": "2026-10-01",
        "isRepaid": false,
        "repaidAt": null,
        "isOverdue": true,
        "notes": "Fuel share",
        "createdAt": "2026-09-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 2,
      "limit": 50,
      "offset": 0
    }
  }
  ```
- **Error Cases:**
  - `400 Bad Request`: Invalid query parameter values.
  - `401 Unauthorized`: Bearer token missing.

---

#### `GET /api/v1/loans/:id`
- **Purpose:** Retrieves a single loan record by ID.
- **Auth:** Required (`Bearer`).
- **Path Parameters:** `id`: Unique loan ID string.
- **Success Response (`200 OK`):**
  ```json
  {
    "loan": {
      "id": "loan_01HABC987654321",
      "friendName": "Sarah Jenkins",
      "amount": "250.00",
      "dueDate": "2026-11-20",
      "isRepaid": false,
      "repaidAt": null,
      "isOverdue": false,
      "notes": "Concert ticket and dinner",
      "createdAt": "2026-10-23T15:05:00.000Z",
      "updatedAt": "2026-10-23T15:05:00.000Z"
    }
  }
  ```
- **Error Cases:**
  - `401 Unauthorized`: Token missing or invalid.
  - `404 Not Found`: Loan does not exist OR belongs to another user (prevents ID guessing).

---

#### `PATCH /api/v1/loans/:id/repay`
- **Purpose:** Marks a loan as settled / repaid.
- **Auth:** Required (`Bearer`).
- **Path Parameters:** `id`: Unique loan ID.
- **Request Body (Optional):**
  ```json
  {
    "repaidAt": "2026-10-23T15:10:00.000Z"
  }
  ```
  *(If omitted, the backend defaults to the current UTC timestamp).*
- **Business Rule:**
  - A loan that is already marked repaid cannot be repaid a second time (idempotency guard). A second call returns `409 Conflict` with message `"Loan has already been marked as repaid"`, preventing duplicate updates to timestamps or totals.
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "loan": {
      "id": "loan_01HABC987654321",
      "friendName": "Sarah Jenkins",
      "amount": "250.00",
      "dueDate": "2026-11-20",
      "isRepaid": true,
      "repaidAt": "2026-10-23T15:10:00.000Z",
      "isOverdue": false,
      "updatedAt": "2026-10-23T15:10:00.000Z"
    }
  }
  ```
- **Error Cases:**
  - `401 Unauthorized`: Bearer token missing or invalid.
  - `404 Not Found`: Loan not found or belongs to another user.
  - `409 Conflict`: Loan is already marked as repaid (`{"statusCode": 409, "error": "Conflict", "message": "Loan has already been marked as repaid"}`).

---

### 3.4 Summary Analytics Endpoint

#### `GET /api/v1/summary`
- **Purpose:** Computes aggregated financial totals across all loans owned by the authenticated user.
- **Auth:** Required (`Bearer`).
- **Calculation Semantics:**
  - `totalLent`: $\sum \text{amount}$ for all created loans owned by the user.
  - `totalRepaid`: $\sum \text{amount}$ for loans where $\text{isRepaid} = \text{true}$.
  - `overdueAmount`: $\sum \text{amount}$ for loans where $\text{isRepaid} = \text{false} \;\land\; \text{dueDate} < \text{today}$.
  - `outstandingAmount`: Money currently outstanding: $\text{totalLent} - \text{totalRepaid}$.
- **Success Response (`200 OK`):**
  ```json
  {
    "summary": {
      "totalLent": "370.00",
      "totalRepaid": "0.00",
      "overdueAmount": "120.00",
      "outstandingAmount": "370.00",
      "counts": {
        "totalLoans": 2,
        "activeLoans": 1,
        "overdueLoans": 1,
        "repaidLoans": 0
      }
    }
  }
  ```
- **Error Cases:**
  - `401 Unauthorized`: Missing or invalid Bearer token.
