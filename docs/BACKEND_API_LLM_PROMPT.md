# LLM implementation prompt: VTracker REST API (domain data)

Copy everything below the line into a new chat with your coding LLM, or use this file as the single source of truth for backend work.

---

## Your role

You are implementing the **remaining HTTP API** for **VTracker**, a hotel construction / build-project tracker. The **authentication layer already exists** on the server (cookie session + CSRF). Your job is to implement **all data APIs** that mirror the behavior of the current **React UI mock layer** so the frontend can switch from `localStorage` mocks to real `fetch` calls.

Do **not** re-implement auth from scratch unless explicitly missing; **extend** the existing API and OpenAPI document.

---

## Product context

- **Users** own one or more **projects** (e.g. a new hotel build).
- Each **project** has **phases** (tasks) with date ranges and status.
- Each project has **vendors**; each vendor can have **invoices** and **payments** against those invoices.
- Users attach **documents** (invoice PDFs, payment proofs, progress photos) to a project, optionally linked to vendor / invoice / payment.
- A **report** summarizes financial totals by project, by vendor, and lists phase status (the UI can compute from list endpoints, or you may expose a dedicated report endpoint).

---

## Already implemented (do not duplicate)

The backend **already exposes** (per existing OpenAPI / Swagger):

- **Session cookie**: HTTP-only cookie (e.g. `vtracker.sid`), set on login.
- **CSRF**: `GET /api/v1/auth/csrf-token` returns `{ "csrfToken": string }`.  
  All **state-changing** requests (`POST`, `PUT`, `PATCH`, `DELETE`) must include header:  
  `X-CSRF-Token: <csrfToken>`  
  (Obtain a fresh token before each mutation or after login response if your contract returns a new token.)
- **Auth**:
  - `POST /api/v1/auth/login` — JSON `{ "email", "password" }`, establishes session.
  - `GET /api/v1/auth/me` — returns current user (e.g. `{ "user": SessionUser }`).
  - `POST /api/v1/auth/logout` — destroys session.

**Authorization rule for all new routes:** the authenticated user (from session) may only read/write rows **they own** (e.g. `project.userId` must equal current user’s id). Return **404** (preferred) or **403** for cross-tenant access — do not leak existence.

---

## Conventions for new endpoints

- **Base path:** `/api/v1/...` (same versioning as auth).
- **Content-Type:** `application/json` for JSON bodies.
- **Cookies:** `credentials: 'include'` on the frontend; design CORS accordingly for non-proxy deployments.
- **IDs in JSON:** The React app types use **string** IDs for all entities (`Project.id`, `Phase.id`, etc.). Prefer **UUID strings** in API responses for new tables so the UI maps without change. If you use integer PKs internally, serialize them as strings in JSON **or** document the breaking change; **UUID strings are strongly preferred** for public API consistency.
- **Timestamps:** ISO-8601 strings (UTC), e.g. `createdAt`, `updatedAt`, `uploadedAt`.
- **Dates (calendar):** phases and invoices use **date** strings as the UI sends them today (often `YYYY-MM-DD` from `<input type="date">`). Accept and return ISO date strings; store as `DATE` or normalize consistently.

---

## Domain model (must match semantics)

### Enums

- **ProjectStatus:** `planning` | `active` | `on_hold` | `completed`
- **PhaseStatus:** `not_started` | `in_progress` | `done`
- **InvoiceStatus:** `draft` | `sent` | `paid` | `partial` | `overdue`
- **DocumentKind:** `invoice` | `payment_proof` | `progress_photo` | `other`

### Entities (logical fields)

**Project**

- `id` (string UUID)
- `userId` (string — must match authenticated user; set server-side on create)
- `name` (string, trimmed)
- `description` (string, trimmed; allow empty string if you prefer, UI sends text)
- `location` (optional string)
- `status` — `ProjectStatus`
- `createdAt`, `updatedAt` — ISO timestamps

**Phase** (belongs to one project)

- `id`, `projectId`
- `name`, optional `description`
- `startDate`, `endDate` — date strings
- `status` — `PhaseStatus`
- `order` — non-negative integer; UI sorts by `order` then `startDate`. On create, set to `max(order)+1` within project (or 0 if first).

**Vendor** (belongs to one project)

- `id`, `projectId`
- `name`
- optional: `contactName`, `email`, `phone`, `notes`

**Invoice** (belongs to project + vendor)

- `id`, `projectId`, `vendorId`
- `invoiceNumber` (string)
- `amount` (number; use decimal in DB)
- `currency` (string; default `"INR"` if omitted on create)
- `issuedDate`, optional `dueDate` (date strings)
- `status` — `InvoiceStatus`

**Payment** (belongs to project + invoice; `vendorId` redundant but required in UI model — **denormalize** from invoice’s vendor for consistency)

- `id`, `projectId`, `invoiceId`, `vendorId` (must match invoice’s vendor)
- `amount` (decimal)
- `paidDate` (date string)
- optional: `method`, `reference`

**ProjectDocument**

- `id`, `projectId`
- optional links: `vendorId`, `invoiceId`, `paymentId` (validate FKs belong to same project)
- `kind` — `DocumentKind`
- `fileName`, `mimeType`, `sizeBytes`
- `uploadedAt` — ISO timestamp
- **Storage:** do **not** require base64-in-JSON for production. Use **multipart upload** (`multipart/form-data`) or **pre-signed URL** pattern; store files on disk/S3/blob and persist metadata + storage key/path. Return a **download URL** or **authenticated download route** in the document resource as needed.

---

## Required REST operations (parity with current UI mock)

Implement routes so the frontend can replace each mock function below.

### Projects

| Operation | Behavior |
|-----------|----------|
| List projects | `GET` — return all projects for **current user**, sorted by `updatedAt` descending. |
| Get one | `GET` — 404 if missing or not owned. |
| Create | `POST` — body: `name`, `description`, optional `location`, optional `status` (default `planning`). Set `userId` from session. |
| Update | `PATCH` or `PUT` — partial update: `name`, `description`, `location`, `status`. Bump `updatedAt`. |
| Delete | `DELETE` — **cascade** delete all phases, vendors, invoices, payments, documents for that project (same as mock). |

### Phases (scoped under project)

| Operation | Behavior |
|-----------|----------|
| List | `GET .../projects/:projectId/phases` — 404 if project not found/not owned. Sort: `order` asc, then `startDate`. |
| Create | `POST` — body: `name`, optional `description`, `startDate`, `endDate`, optional `status` (default `not_started`). Auto-assign `order`. Update parent project `updatedAt`. |
| Update | `PATCH` — partial: `name`, `description`, `startDate`, `endDate`, `status`, `order`. Update project `updatedAt`. |
| Delete | `DELETE` — remove phase; update project `updatedAt`. |

### Vendors

| Operation | Behavior |
|-----------|----------|
| List | `GET .../projects/:projectId/vendors` — sort by `name` asc. |
| Create | `POST` — optional contact fields. Update project `updatedAt`. |
| Update | `PATCH` — partial vendor fields. Update project `updatedAt`. |
| Delete | `DELETE` — **cascade**: remove vendor’s invoices and payments (and document links as in mock); update project `updatedAt`. |

### Invoices

| Operation | Behavior |
|-----------|----------|
| List | `GET .../projects/:projectId/invoices` — sort by `issuedDate` desc. |
| Create | `POST` — `vendorId` must belong to same project. Defaults: `currency`=`INR`, `status`=`sent` unless specified. Update project `updatedAt`. |
| Update | `PATCH` — partial invoice fields. Update project `updatedAt`. |
| Delete | `DELETE` — remove invoice and its **payments** and clear document links to that invoice. Update project `updatedAt`. |

### Payments

| Operation | Behavior |
|-----------|----------|
| List | `GET .../projects/:projectId/payments` — sort by `paidDate` desc. |
| Create | `POST` — `invoiceId` must belong to same project. Set `vendorId` from invoice. **After insert**, recompute invoice `status` from sum(payments) vs `invoice.amount`: `paid` if `sum >= amount`, `partial` if `0 < sum < amount`, else keep appropriate state (see mock logic). Update project `updatedAt`. |
| Delete | `DELETE` — remove payment; **recompute** invoice status from remaining payments; remove document links to payment. Update project `updatedAt`. |

**Invoice status reconciliation (must match mock intent):**

- After payment create/delete:  
  - If total paid `<= 0`: if invoice was `draft` stay `draft`, else `sent` (or equivalent unpaid state).  
  - If `total paid >= invoice.amount` → `paid`.  
  - If `0 < total < amount` → `partial`.

### Documents

| Operation | Behavior |
|-----------|----------|
| List | `GET .../projects/:projectId/documents` — sort by `uploadedAt` desc. |
| Upload | `POST` (multipart) — fields: `kind`, optional `vendorId`, `invoiceId`, `paymentId`; file field e.g. `file`. Enforce max size (configurable; mock used ~450KB). Validate linked IDs belong to project. Update project `updatedAt`. |
| Delete | `DELETE` — remove metadata **and** stored blob. Update project `updatedAt`. |

### Reports (optional dedicated endpoint)

The UI aggregates:

- `totalInvoiced`, `totalPaid`, `outstanding = max(0, invoiced - paid)`
- `byVendor[]`: per vendor `invoiced` sum, `paid` sum
- `byPhase[]`: phase id, name, status (ordered by phase `order`)
- `invoiceCount`, `paymentCount`

You may implement:

- `GET /api/v1/projects/:projectId/report` returning a JSON object with those fields,

or document that the **frontend will compute** from list endpoints (acceptable if performance is fine).

---

## Error handling

- **400** — validation errors (body: `{ "message": string }` or structured errors).
- **401** — not authenticated (auth routes already use this).
- **404** — resource not found or not owned.
- **413** — payload too large (uploads).
- **429** — rate limit where applicable (login already may use this).

---

## Database expectations

- Use proper **foreign keys** and **transactions** for cascades and payment/invoice updates.
- Index common filters: `(userId)`, `(projectId)` on child tables.

---

## OpenAPI / Swagger

- **Update** the existing OpenAPI 3 document served at `/api-docs.json` (or project equivalent) with **all new paths**, schemas, security (`sessionCookie`), and CSRF notes on mutating routes.
- Tag new routes (e.g. `Projects`, `Phases`, `Vendors`, `Invoices`, `Payments`, `Documents`, `Reports`).

---

## Frontend integration notes (for you as implementer)

- The React app currently imports **`mockApi.ts`** for projects/vendors/etc. A future step will add a **`realApi.ts`** that calls these endpoints with `credentials: 'include'` and CSRF headers on mutations. Your response shapes should match the **TypeScript interfaces** in the UI repo under `src/types/index.ts` (field names and enum string values).
- Auth user id: session user may be numeric in DB; **expose** `userId` in project rows consistently as string if the UI expects string (see types).

---

## Acceptance checklist

- [ ] All routes require authenticated session except those already public (`/health`, `/api-docs`, etc.).
- [ ] CSRF enforced on all mutating methods per existing middleware.
- [ ] Multi-tenant isolation: users cannot access other users’ projects.
- [ ] Cascade deletes match the mock behavior.
- [ ] Payment create/delete updates invoice `status` correctly.
- [ ] File upload is production-appropriate (not giant JSON base64).
- [ ] OpenAPI updated and browsable in Swagger UI.

---

## Reference: mock implementation (behavioral spec)

The reference logic to mirror (including edge cases) lives in the frontend repository file:

`src/api/mockApi.ts`

Use it as the **authoritative behavioral spec** for sorting, defaults, cascade rules, and invoice status math.

---

*End of prompt.*
