# Finance Dashboard Backend

A backend API for a finance dashboard system where users with different roles can interact with financial records, view analytics, and manage data based on their access level.

Built with Node.js, Express, and SQLite.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Roles and Access Control](#roles-and-access-control)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication)
  - [Users](#users)
  - [Financial Records](#financial-records)
  - [Dashboard / Analytics](#dashboard--analytics)
  - [Health Check](#health-check)
- [Filtering, Pagination, and Search](#filtering-pagination-and-search)
- [Validation and Error Handling](#validation-and-error-handling)
- [Soft Delete](#soft-delete)
- [Running Tests](#running-tests)
- [Seed Data](#seed-data)
- [Assumptions and Tradeoffs](#assumptions-and-tradeoffs)

---

## Overview

This project is a RESTful backend for a finance dashboard. It supports:

- **User registration and login** with JWT-based authentication
- **Role-based access control** with three roles: Admin, Analyst, and Viewer
- **CRUD operations** on financial records (income and expense entries)
- **Dashboard analytics** including total income/expenses, net balance, category breakdowns, monthly trends, and recent activity
- **Pagination, filtering, and search** across records
- **Soft delete** for financial records to preserve data integrity
- **Input validation** and structured error responses on every endpoint

The idea is to simulate a backend that could power a real finance dashboard frontend, with proper separation of concerns and clean API design.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Authentication | JWT ([jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)) |
| Password Hashing | [bcryptjs](https://github.com/dcodeIO/bcrypt.js) |
| Validation | [express-validator](https://express-validator.github.io/) |
| Testing | Jest + Supertest |

I chose SQLite because it needs zero setup — no external database server, no Docker, just `npm install` and it works. The `better-sqlite3` driver is synchronous which keeps the code simple and avoids callback/promise complexity for database calls. For a project of this scope, it's more than enough.

---

## Project Structure

```
src/
├── app.js                    # Express app setup, route mounting, error handling
├── seed.js                   # Script to populate the database with sample data
├── middleware/
│   └── auth.js               # JWT verification + role-based authorization middleware
├── models/
│   └── database.js           # SQLite connection, schema creation, indexes
├── routes/
│   ├── auth.js               # POST /register, POST /login
│   ├── users.js              # User management endpoints (admin only)
│   ├── records.js            # Financial record CRUD endpoints
│   └── dashboard.js          # Analytics and summary endpoints
├── services/
│   ├── userService.js        # User business logic (register, login, CRUD)
│   ├── recordService.js      # Record business logic (create, list, update, delete)
│   └── dashboardService.js   # Aggregation queries (summary, trends, categories)
└── utils/
    └── errors.js             # Custom error classes (AppError, notFound, forbidden, etc.)

tests/
└── api.test.js               # 31 integration tests covering all endpoints
```

The separation is straightforward:
- **Routes** handle HTTP concerns — request parsing, validation rules, status codes
- **Services** contain the actual business logic and database queries
- **Middleware** handles cross-cutting concerns like auth
- **Models** owns the database connection and schema

This keeps each file focused on one thing and makes it easy to find where any piece of logic lives.

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd zorvyn-assignment

# Install dependencies
npm install

# (Optional) Seed the database with sample data
npm run seed

# Start the server
npm start
```

The server starts at `http://localhost:3000` by default.

---

## Environment Variables

Create a `.env` file in the project root:

```
PORT=3000
JWT_SECRET=your-secret-key-here
DB_PATH=./data/finance.db
```

All three are optional — the app has sensible defaults. In a real deployment you'd want a strong random string for `JWT_SECRET`.

---

## Database Schema

### `users` table

| Column | Type | Notes |
|---|---|---|
| id | INTEGER | Primary key, auto-increment |
| email | TEXT | Unique, not null |
| password | TEXT | bcrypt hash |
| name | TEXT | Not null |
| role | TEXT | `admin`, `analyst`, or `viewer` (default: `viewer`) |
| status | TEXT | `active` or `inactive` (default: `active`) |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

### `financial_records` table

| Column | Type | Notes |
|---|---|---|
| id | INTEGER | Primary key, auto-increment |
| user_id | INTEGER | Foreign key to `users.id` |
| amount | REAL | Must be positive |
| type | TEXT | `income` or `expense` |
| category | TEXT | Free-text (e.g., Salary, Rent, Food) |
| date | TEXT | ISO date (YYYY-MM-DD) |
| description | TEXT | Optional |
| deleted_at | TEXT | Null if active, timestamp if soft-deleted |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

Indexes exist on `user_id`, `type`, `category`, `date`, and `deleted_at` for query performance.

---

## Roles and Access Control

There are three roles, each with increasing levels of access:

| Action | Viewer | Analyst | Admin |
|---|:---:|:---:|:---:|
| View own profile (`GET /api/users/me`) | Yes | Yes | Yes |
| View financial records | Yes | Yes | Yes |
| Access dashboard analytics | No | Yes | Yes |
| Create / update / delete records | No | No | Yes |
| Manage users (list, update, delete) | No | No | Yes |

Access control is enforced through two middleware functions in `src/middleware/auth.js`:

1. **`authenticate`** — Verifies the JWT token from the `Authorization: Bearer <token>` header, loads the user from the database, and checks that the account is active.
2. **`authorize(...roles)`** — Takes a list of allowed roles and rejects the request with a 403 if the user's role isn't in the list.

These are applied at the route level. For example, dashboard routes use `authorize('admin', 'analyst')` so viewers are blocked, while record creation uses `authorize('admin')` so only admins can write data.

---

## API Endpoints

All endpoints return JSON. Authenticated endpoints require an `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create a new user account |
| `POST` | `/api/auth/login` | No | Login and receive a JWT token |

**Register** — request body:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "viewer"
}
```
- `role` is optional, defaults to `viewer`
- Password must be at least 6 characters
- Returns the created user object and a JWT token

**Login** — request body:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
- Returns the user object (without password) and a JWT token
- Token expires in 24 hours

---

### Users

All user management endpoints require **Admin** role.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users/me` | Get the currently authenticated user's profile (any role) |
| `GET` | `/api/users` | List all users (paginated) |
| `GET` | `/api/users/:id` | Get a specific user by ID |
| `PATCH` | `/api/users/:id` | Update a user's name, role, or status |
| `DELETE` | `/api/users/:id` | Permanently delete a user |

**List users** supports query params: `page`, `limit`, `status` (`active`/`inactive`), `role` (`admin`/`analyst`/`viewer`)

**Update user** — request body (all fields optional):
```json
{
  "name": "New Name",
  "role": "analyst",
  "status": "inactive"
}
```

---

### Financial Records

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/records` | All roles | List records (paginated, filterable) |
| `GET` | `/api/records/:id` | All roles | Get a single record |
| `POST` | `/api/records` | Admin | Create a new record |
| `PATCH` | `/api/records/:id` | Admin | Update a record |
| `DELETE` | `/api/records/:id` | Admin | Soft-delete a record |

**Create record** — request body:
```json
{
  "amount": 5000,
  "type": "income",
  "category": "Salary",
  "date": "2026-01-15",
  "description": "January salary"
}
```
- `amount` must be a positive number
- `type` must be `income` or `expense`
- `date` must be in ISO 8601 format (YYYY-MM-DD)
- `description` is optional
- The `user_id` is automatically set from the authenticated user

**Update record** — same fields as create, all optional. Only sends what you want to change.

---

### Dashboard / Analytics

All dashboard endpoints require **Admin** or **Analyst** role. Viewers get a 403.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Total income, total expenses, net balance, record count |
| `GET` | `/api/dashboard/categories` | Totals grouped by category and type |
| `GET` | `/api/dashboard/trends` | Monthly income, expenses, and net over time |
| `GET` | `/api/dashboard/recent` | Most recently created records with user names |

**Summary response example:**
```json
{
  "total_income": 34800,
  "total_expenses": 14550,
  "total_records": 36,
  "net_balance": 20250
}
```

**Category breakdown response example:**
```json
[
  { "category": "Salary", "type": "income", "total": 30000, "count": 6 },
  { "category": "Rent", "type": "expense", "total": 9000, "count": 6 },
  { "category": "Freelance", "type": "income", "total": 4800, "count": 6 }
]
```

**Monthly trends response example:**
```json
[
  { "month": "2026-01", "income": 5800, "expenses": 2100, "net": 3700, "record_count": 6 },
  { "month": "2026-02", "income": 5650, "expenses": 2250, "net": 3400, "record_count": 6 }
]
```

**Query parameters:**

| Endpoint | Params |
|---|---|
| `/api/dashboard/summary` | `date_from`, `date_to` |
| `/api/dashboard/categories` | `date_from`, `date_to`, `type` (`income`/`expense`) |
| `/api/dashboard/trends` | `months` (default: 12, max: 60) |
| `/api/dashboard/recent` | `limit` (default: 10, max: 50) |

---

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns `{ "status": "ok", "timestamp": "..." }` |

No authentication required.

---

## Filtering, Pagination, and Search

The `GET /api/records` endpoint supports several query parameters:

| Param | Description | Example |
|---|---|---|
| `type` | Filter by `income` or `expense` | `?type=expense` |
| `category` | Filter by exact category name | `?category=Rent` |
| `date_from` | Records on or after this date | `?date_from=2026-01-01` |
| `date_to` | Records on or before this date | `?date_to=2026-06-30` |
| `search` | Partial match on description or category | `?search=salary` |
| `page` | Page number (starts at 1) | `?page=2` |
| `limit` | Records per page (1-100, default 20) | `?limit=10` |

All filters can be combined. The response includes pagination metadata:

```json
{
  "records": [...],
  "total": 36,
  "page": 1,
  "limit": 20,
  "totalPages": 2
}
```

---

## Validation and Error Handling

Every endpoint validates its input using `express-validator`. Invalid requests get a 400 response with details about what went wrong:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "type": "field",
      "msg": "Amount must be a positive number",
      "path": "amount",
      "location": "body"
    }
  ]
}
```

The app uses consistent HTTP status codes:

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (no content) |
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 403 | Insufficient role permissions |
| 404 | Resource not found |
| 500 | Internal server error |

There's a global error handler in `app.js` that catches all unhandled errors and returns a clean JSON response instead of leaking stack traces.

---

## Soft Delete

Financial records use **soft delete** instead of permanent deletion. When a record is deleted via `DELETE /api/records/:id`, it sets the `deleted_at` timestamp rather than removing the row.

All queries automatically exclude soft-deleted records (`WHERE deleted_at IS NULL`), so they're invisible through the API but still exist in the database for audit purposes.

I chose this approach because in a finance system, you generally don't want to permanently lose transaction data — even if someone deletes it through the UI.

---

## Running Tests

```bash
npm test
```

This runs 31 integration tests using Jest and Supertest. Tests use an **in-memory SQLite database** (`:memory:`) so they don't touch the real data.

The test suite covers:

- **Auth:** Registration (success, duplicate email, invalid input), login (success, wrong password)
- **Users:** Profile fetch, admin listing users, viewer access denied, user updates, unauthenticated access
- **Records:** Admin CRUD, viewer read-only access, input validation, filtering by type, soft delete behavior
- **Dashboard:** Summary totals, category breakdown, monthly trends, recent activity, viewer access denied, date filtering
- **Edge cases:** 404 for unknown routes, malformed JSON handling, health check

---

## Seed Data

Run `npm run seed` to populate the database with sample data for manual testing:

**Test accounts:**

| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | admin123 |
| Analyst | analyst@example.com | analyst123 |
| Viewer | viewer@example.com | viewer123 |

The seeder also creates 36 financial records spanning 6 months — a mix of salary, freelance income, rent, utilities, food, and transport expenses. This gives you enough data to see meaningful results from the dashboard endpoints.

---

## Assumptions and Tradeoffs

1. **Role assignment at registration is open.** In a real system, only admins would assign roles. I kept it open here so it's easy to create test accounts with different roles without needing a separate admin-setup step.

2. **SQLite instead of Postgres/MySQL.** I went with SQLite for zero-config portability — anyone can clone and run this without setting up a database server. The schema, queries, and indexes would translate to a production database with minimal changes.

3. **Synchronous database calls.** `better-sqlite3` is synchronous by design. For a single-user assessment project this is perfectly fine and keeps the code simpler. In a high-concurrency production system, you'd use an async driver with connection pooling.

4. **JWT tokens with no refresh flow.** Tokens expire in 24 hours. I didn't implement refresh tokens or token revocation since that adds complexity without demonstrating anything new about the core requirements.

5. **No rate limiting.** Mentioned as an optional enhancement. I focused on getting the core features right instead of adding middleware that doesn't demonstrate backend logic.

6. **Passwords are hashed with bcrypt (10 rounds).** Standard and secure enough for this context.

7. **All financial records are visible to all authenticated users.** The access control is on *actions* (who can create/edit/delete) rather than *data* (who can see which records). In a multi-tenant production system, you'd scope queries by organization or user.

8. **Dates are stored as ISO strings.** SQLite doesn't have a native date type, so I use TEXT with ISO 8601 format. SQLite's date functions (`strftime`, `date()`) work correctly with this format for the dashboard aggregation queries.
