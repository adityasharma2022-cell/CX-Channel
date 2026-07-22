# Migration Guide: JSON File Storage → MySQL Database

## Project Overview

The current application stores all RMA (Return Merchandise Authorization) requests inside a single `requests.json` file. The backend performs file system operations (`fs.readFileSync` and `fs.writeFileSync`) whenever data needs to be read or updated.

Example:

```javascript
const requests = JSON.parse(fs.readFileSync("./requests.json", "utf8"));
```

Whenever a request is created or updated:

```javascript
fs.writeFileSync("./requests.json", JSON.stringify(requests, null, 2));
```

Although this approach works during development, it is not suitable for production deployments or applications that expect multiple concurrent users.

---

# Current Problems

## 1. Entire File Must Be Read

Every operation requires loading the complete JSON file into memory.

Current Flow:

```
User Request
      │
      ▼
Read requests.json
      │
      ▼
Parse Entire File
      │
      ▼
Modify Object
      │
      ▼
Write Entire File Back
```

Even if only one field changes, the complete file is rewritten.

---

## 2. Concurrent Write Issues

If two users submit requests simultaneously:

```
User A --------┐
               │
               ▼
        Read JSON File
               ▲
               │
User B --------┘
```

Both users receive the same copy of the data.

Example:

Current file:

```json
[{ "id": 1 }]
```

User A adds:

```json
[{ "id": 1 }, { "id": 2 }]
```

User B adds:

```json
[{ "id": 1 }, { "id": 3 }]
```

If User B writes after User A, the final file becomes:

```json
[{ "id": 1 }, { "id": 3 }]
```

Request **2** is permanently lost.

This is known as a **race condition**.

---

## 3. Performance Degrades

Searching for records currently requires:

```javascript
requests.filter((r) => r.status === "open");
```

This loops through every record.

With thousands of requests, performance will continue to decrease.

---

## 4. No Database Features

Using a JSON file means losing important capabilities such as:

- Indexing
- Transactions
- Foreign Keys
- Constraints
- Efficient Searching
- Concurrent Writes
- Query Optimization
- Backup Utilities

---

## 5. Difficult Maintenance

Currently, one large object contains:

- Customer Information
- Request Information
- Processing Information
- Images
- Statuses

Everything is stored together.

This creates duplicated data and makes future modifications more difficult.

---

# Recommended Solution

Migrate the application to **MySQL**.

Since the application will be deployed on a **cPanel server**, MySQL is the best choice because:

- Already supported by most cPanel hosting providers
- Easy backup using phpMyAdmin
- Production ready
- Reliable
- Handles multiple users safely
- Better performance

---

# New Application Architecture

Current:

```
Browser
    │
    ▼
Node.js
    │
    ▼
requests.json
```

Proposed:

```
Browser
    │
    ▼
Node.js
    │
    ▼
Express
    │
    ▼
Prisma ORM
    │
    ▼
MySQL
```

---

# Advantages After Migration

## Faster Queries

Instead of:

```javascript
requests.filter((r) => r.status === "open");
```

Use:

```sql
SELECT *
FROM requests
WHERE status = 'open';
```

The database uses indexes instead of scanning every record.

---

## Better Searching

Search by:

- Customer Name
- Email
- Product
- OEM
- Status
- RMA Number

without loading every record.

---

## Safe Concurrent Users

MySQL safely handles:

- Multiple customers submitting requests
- Admin updating requests
- Dashboard statistics
- Simultaneous writes

No data loss.

---

## Data Integrity

Constraints can prevent invalid data.

Examples:

- Unique RMA Numbers
- Required fields
- Foreign Key relationships
- Valid status values

---

## Easier Reporting

Examples:

```
Open Requests

Pending Requests

Closed Requests

OEM Wise Reports

Customer Wise Reports

Monthly Statistics

Average Processing Time
```

All can be generated efficiently using SQL queries.


## Phase 5

Replace all file system operations.

Replace:

```javascript
fs.readFileSync(...)
```

with Prisma queries such as:

```javascript
await prisma.request.findMany();
```

Replace:

```javascript
fs.writeFileSync(...)
```

with:

```javascript
await prisma.request.create(...)
await prisma.request.update(...)
```

---

## Phase 6

Remove the dependency on `requests.json`.

The database becomes the single source of truth.

---

# Recommended Technology Stack

| Component     | Technology                                                |
| ------------- | --------------------------------------------------------- |
| Frontend      | HTML, CSS, JavaScript                                     |
| Backend       | Node.js + Express                                         |
| ORM           | Prisma                                                    |
| Database      | MySQL                                                     |
| Hosting       | cPanel                                                    |
| Image Storage | Local `uploads/` directory (or cloud storage if required) |

---

# Expected Outcome

After migration:

- No more JSON file read/write operations
- Production-ready architecture
- Faster request processing
- Reliable concurrent access
- Easier maintenance
- Better scalability
- Improved data integrity
- Cleaner backend code through Prisma ORM

This migration will modernize the application's persistence layer while remaining fully compatible with the existing Node.js backend and cPanel hosting environment.
