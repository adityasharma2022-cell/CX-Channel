# Database Migration Plan: JSON Files → MySQL + Prisma

## Overview

Migrate the CX-Channel application from file-based JSON storage (`requests.json`, `users.json`, `support.json`) to MySQL using Prisma as the ORM. Passwords will be hashed with bcryptjs.

---

## Step 1: Install Dependencies

```bash
cd /Users/rahul/development/Smtp-test/CX-Channel/server
npm install prisma @prisma/client bcryptjs
npx prisma init --datasource-provider mysql
```

Remove `better-sqlite3` and the unused `database.js`/`createUser.js`.

---

## Step 2: Create Prisma Schema

**File:** `server/prisma/schema.prisma`

### User Model
| Field         | Type         | Notes                        |
|---------------|--------------|------------------------------|
| id            | Int @id @default(autoincrement()) | |
| firstName     | String?      |                              |
| lastName      | String?      |                              |
| username      | String @unique |                             |
| email         | String @unique |                             |
| password      | String       | bcrypt hashed                |
| role          | String       | "team" or "customer"         |
| department    | String?      | "admin", "service", etc.     |
| createdAt     | DateTime @default(now()) |                  |

### Request Model
| Field                    | Type              | Notes                          |
|--------------------------|-------------------|--------------------------------|
| id                       | String @id        | e.g. "SUB-178462563288138"    |
| rmaNumber                | String?           | e.g. "00001"                  |
| rmaIssuedAt              | String?           | IST date string               |
| pendingForCustomer       | String @default("") | Flag field                   |
| pendingForFastech        | String @default("") | Flag field                   |
| pendingForOem            | String @default("") | Flag field                   |
| customStatus             | String @default("") |                             |
| approvalStatus           | String @default("") |                             |
| customerMailStatus       | String @default("") |                             |
| disapprovalReason        | String @default("") |                             |
| oem                      | String            |                                |
| serviceType              | String            |                                |
| product                  | String            |                                |
| description              | String @default("") |                             |
| name                     | String            |                                |
| email                    | String            |                                |
| phone                    | String @default("") |                             |
| company                  | String @default("") |                             |
| designation              | String @default("") |                             |
| location                 | String @default("") |                             |
| poNumber                 | String @default("") |                             |
| poDate                   | String @default("") |                             |
| serialSingle             | String @default("") |                             |
| serialBaseUnit           | String @default("") |                             |
| serialRfCable            | String @default("") |                             |
| serialAntenna            | String @default("") |                             |
| billingAddress           | String @default("") |                             |
| returnAddress            | String @default("") |                             |
| calCertificateAddress    | String @default("") |                             |
| additionalInfo           | String @default("") |                             |
| status                   | String @default("new") |                           |
| customerFeedback         | String @default("") |                             |
| internalNote             | String @default("") |                             |
| createdAt                | String            | IST date string               |
| updatedAt                | String            | IST date string               |
| **Processing Details (flattened):** | | |
| ipAdminNote              | String @default("") |                             |
| ipReceivedDate           | String @default("") |                             |
| ipDateOfInvestigation    | String @default("") |                             |
| ipWarranty               | String @default("") |                             |
| ipInvestigationDetails   | String @default("") |                             |
| ipRepairDetails          | String @default("") |                             |
| ipEstimateDate           | String @default("") |                             |
| ipEstimateNumber         | String @default("") |                             |
| ipEstimateAmount         | String @default("") |                             |
| ipPoNoAndDate            | String @default("") |                             |
| ipPoReceivedDate         | String @default("") |                             |
| ipOemRmaNo               | String @default("") |                             |
| ipDateOfSent             | String @default("") |                             |
| ipPlatformModule         | String @default("") |                             |
| ipOemQuotation           | String @default("") |                             |
| ipDateOfReceivingFromOem | String @default("") |                             |
| ipDcNoAndDate            | String @default("") |                             |
| ipDispatchedDate         | String @default("") |                             |
| ipLrNo                   | String @default("") |                             |
| ipReasonForWaiting       | String @default("") |                             |
| ipDeliveredDate          | String @default("") |                             |
| ipAckDateFromWh          | String @default("") |                             |
| ipRemark                 | String @default("") |                             |

### Support Model
| Field                    | Type              | Notes                          |
|--------------------------|-------------------|--------------------------------|
| id                       | String @id        | e.g. "TMI-178387836349496"   |
| rmaNumber                | String @default("") |                             |
| subject                  | String @default("") |                             |
| priority                 | String @default("Medium") |                       |
| oem                      | String            |                                |
| serviceType              | String @default("Support") |                       |
| product                  | String            |                                |
| description              | String @default("") |                             |
| name                     | String            |                                |
| email                    | String            |                                |
| phone                    | String @default("") |                             |
| company                  | String @default("") |                             |
| designation              | String @default("") |                             |
| softwareVersion          | String @default("") |                             |
| serialSingle             | String @default("") |                             |
| serialBaseUnit           | String @default("") |                             |
| serialRfCable            | String @default("") |                             |
| serialAntenna            | String @default("") |                             |
| billingAddress           | String @default("") |                             |
| returnAddress            | String @default("") |                             |
| calCertificateAddress    | String @default("") |                             |
| additionalInfo           | String @default("") |                             |
| status                   | String @default("Open") |                           |
| assignedTeam             | String @default("") |                             |
| assignedName             | String @default("") |                             |
| approvalStatus           | String @default("") |                             |
| customerMailStatus       | String @default("") |                             |
| disapprovalReason        | String @default("") |                             |
| internalNote             | String @default("") |                             |
| customerFeedback         | String @default("") |                             |
| pendingForCustomer       | String @default("") |                             |
| pendingForFastech        | String @default("") |                             |
| pendingForOem            | String @default("") |                             |
| createdAt                | String            | IST date string               |
| updatedAt                | String            | IST date string               |

### RequestImage Model (separate table for images)
| Field        | Type         | Notes                    |
|--------------|--------------|--------------------------|
| id           | Int @id @default(autoincrement()) | |
| requestId    | String       | FK → Request.id          |
| originalName | String       |                          |
| fileName     | String       |                          |
| path         | String       |                          |
| mimeType     | String       |                          |
| size         | Int          |                          |

### SupportImage Model (separate table for support images)
| Field        | Type         | Notes                    |
|--------------|--------------|--------------------------|
| id           | Int @id @default(autoincrement()) | |
| supportId    | String       | FK → Support.id          |
| originalName | String       |                          |
| fileName     | String       |                          |
| path         | String       |                          |
| mimeType     | String       |                          |
| size         | Int          |                          |

---

## Step 3: Create Database Connection Module

**File:** `server/prisma.js`

Export a singleton PrismaClient instance.

---

## Step 4: Update server.js

Replace all `readJSON`/`writeJSON`/`readDB`/`writeDB`/`readSupport`/`writeSupport`/`readUsers` calls with Prisma queries.

### Changes by Endpoint:

| Endpoint              | Current               | New                                    |
|-----------------------|-----------------------|----------------------------------------|
| `POST /api/auth/login`    | `readUsers().find()` | `prisma.user.findFirst({ where: { username, role: "team" } })` + `bcrypt.compare()` |
| `POST /api/auth/customer-login` | `readUsers().find()` | `prisma.user.findFirst({ where: { username, role: "customer" } })` + `bcrypt.compare()` |
| `POST /auth/signup`       | `readUsers()` + `writeJSON()` | `prisma.user.create()` with `bcrypt.hash()` |
| `GET /api/requests`       | `readDB()`           | `prisma.request.findMany({ include: { images: true }, orderBy: [...] })` |
| `GET /api/requests/:id`   | `readDB()` + `.find()` | `prisma.request.findUnique({ where: { id }, include: { images: true } })` |
| `POST /api/requests`      | `readDB()` + push + `writeDB()` | `prisma.request.create({ data: {...}, include: { images: true } })` |
| `PUT /api/requests/:id`   | `readDB()` + findIndex + `writeDB()` | `prisma.request.update({ where: { id }, data: {...}, include: { images: true } })` |
| `DELETE /api/requests/:id`| `readDB()` + filter + `writeDB()` | `prisma.request.delete({ where: { id } })` |
| `GET /api/export/csv`     | `readDB()`           | `prisma.request.findMany()` with `include: { images: true }` |
| `GET /api/stats`          | `readDB()`           | `prisma.request.groupBy({ by: ['status'], _count: true })` + separate queries for pending flags |
| `GET /api/support`        | `readSupport()`      | `prisma.support.findMany({ include: { images: true } })` |
| `GET /api/support/stats`  | `readSupport()`      | `prisma.support.groupBy(...)` |
| `GET /api/support/:id`    | `readSupport().find()` | `prisma.support.findUnique({ where: { id }, include: { images: true } })` |
| `POST /api/support`       | `readSupport()` + push + `writeSupport()` | `prisma.support.create({ data: {...}, include: { images: true } })` |
| `PUT /api/support/:id`    | `readSupport()` + findIndex + `writeSupport()` | `prisma.support.update({ where: { id }, data: {...}, include: { images: true } })` |
| `DELETE /api/support/:id` | `readSupport()` + filter + `writeSupport()` | `prisma.support.delete({ where: { id } })` |
| `GET /api/support/export/csv` | `readSupport()`   | `prisma.support.findMany({ include: { images: true } })` |

### Key Behavioral Preservations:
- **Sorting**: Use Prisma `orderBy` with raw SQL or manual sorting for IST string dates (parseIST logic stays in JS)
- **Processing details**: Flat fields in Request model; construct the `processingDetails` object in the API response for frontend compatibility
- **Images**: Separate `RequestImage`/`SupportImage` tables; return as array in responses
- **RMA number generation**: Query max rmaNumber from DB instead of scanning all records
- **Pending flags**: Check non-empty string in JS after fetch, or use Prisma `where` with `not: ""`

---

## Step 5: Handle Response Shape Compatibility

The frontend expects certain response shapes. The API must return the same JSON structure:

```js
// For requests, reconstruct processingDetails from flat fields:
const { ipAdminNote, ipReceivedDate, ...rest } = request;
const response = {
  ...rest,
  processingDetails: { ipAdminNote, ipReceivedDate, ... },
  images: request.images.map(img => ({
    originalName: img.originalName,
    fileName: img.fileName,
    path: img.path,
    mimeType: img.mimeType,
    size: img.size,
  })),
};
```

---

## Step 6: Environment Variables

Add to `.env`:
```
DATABASE_URL="mysql://user:password@host:3306/cx_channel"
```

---

## Step 7: Run Prisma Migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## Step 8: Cleanup

- Remove `server/database.js`
- Remove `server/createUser.js`
- Remove `server/cxchannel.db`
- Remove `better-sqlite3` from `package.json` dependencies
- Keep `server/data/` directory as backup (add to `.gitignore`)

---

## Files Modified

| File               | Action   |
|--------------------|----------|
| `server/prisma/schema.prisma` | **Create** |
| `server/prisma.js`            | **Create** |
| `server/server.js`            | **Modify** — Replace all file I/O with Prisma queries |
| `server/package.json`         | **Modify** — Add prisma/@prisma/client, remove better-sqlite3 |
| `server/.env`                 | **Modify** — Add DATABASE_URL |
| `server/database.js`          | **Delete** |
| `server/createUser.js`        | **Delete** |
| `server/cxchannel.db`         | **Delete** |
| `server/.gitignore`           | **Create** — Ignore data/ directory |

---

## Execution Order

1. Install prisma + @prisma/client, remove better-sqlite3
2. Create `prisma/schema.prisma` with all 3 models + image models
3. Create `server/prisma.js` (singleton client)
4. Run `npx prisma migrate dev --name init`
5. Update `server.js` — replace all readJSON/writeJSON with Prisma queries
6. Handle password hashing in login + signup endpoints
7. Reconstruct `processingDetails` object in API responses for frontend compat
8. Delete old files (`database.js`, `createUser.js`, `cxchannel.db`)
9. Verify server starts and endpoints work
