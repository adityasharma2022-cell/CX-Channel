# RMA System Update Specification

## Overview

This update includes multiple UI, UX, behavioral, and backend enhancements across the Admin Dashboard and Support Dashboard. All related frontend, backend, Prisma schema, filtering, and sorting logic should remain consistent throughout the application.

---

# 1. Main Dashboard (`index.html`)

## 1.1 Dashboard Status Cards

### Rename Status

- Rename the **New Request** status card to **Fresh Request**.
- The **Open** status should no longer exist anywhere in the application.
- Replace every occurrence of **Open** with **Fresh** across:
  - Dashboard status cards
  - Status badges
  - Filters
  - Tables
  - Dropdowns
  - Backend enums/constants
  - API responses
  - Prisma schema (if applicable)

> Ensure naming remains consistent throughout the application.

---

## 1.2 Request Table Filters

Update the status filter tabs above the RMA Request table.

### Current

- All
- Open
- Pending
- Disapproved
- Closed

### Updated

- All
- Fresh
- Pending
- Disapproved
- Closed
- RMA RECIEVED
- RMA NOT RECIEVED

Ensure the click-based table filtering logic is updated accordingly.

---

## 1.3 View Request Panel

Update the **RMA Status** dropdown inside the View Request panel.

### New Status Options

- Fresh
- Pending
- Disapproved
- Closed
- RMA Received
- RMA Not Received

### Additional Requirements

- **RMA Received** and **RMA Not Received** are **not** dashboard status cards.
- These should instead be managed as a dedicated **RMA Status** within the request table.
- Update all backend logic to support these new statuses.
- If necessary, modify the Prisma schema, enums, validation, and API logic to accommodate these additions.

---

## 1.4 Request Table Enhancements

### Add New Column

Add a new column:

- **RMA Status**

Possible values:

- RMA Received
- RMA Not Received

---

### Table Filters

Expand the filter tabs to support the new RMA statuses.

### Updated Filters

- All
- Fresh
- Pending
- Disapproved
- Closed
- RMA Received
- RMA Not Received

Selecting a filter should instantly display only matching requests.

---

### Sorting Logic

Update the request sorting behavior.

#### Fresh Requests

- Newly submitted customer requests should always appear at the top of the table.
- Every newly created request should automatically have the **Fresh** status.

#### Existing RMA Requests

- Once an RMA has been generated, the request should follow the existing incremental sorting logic already implemented.

---

### Status Cleanup

Remove all remaining references to the **Open** status throughout the project.


---

# 2. Support Dashboard (`team-support-dashboard.html`)

## Ticket / RMA ID Generation

The current ticket format:

```
SUB-1785240153023172
```

should no longer be used.

### New Requirement

Generate the Ticket/RMA ID using the **date and time of the original customer request submission**.

The generated ID should be:

- Chronological
- Human-readable
- Unique
- Consistent across the system

Update every location where this Ticket/RMA ID is:

- Generated
- Stored
- Displayed
- Referenced
- Searched
- Retrieved

This includes both frontend and backend logic.

---

# 3. Backend & Database Alignment

Ensure all backend components are updated to match the new workflow.

This includes:

- Prisma schema (if required)
- Status enums
- Validation logic
- API endpoints
- Database models
- Filtering logic
- Sorting logic
- Dashboard statistics
- Request counts
- Table queries
- Status transitions

Maintain complete consistency between the frontend and backend implementation.

---

# Expected Final Status Flow

```
Fresh
   ↓
Pending
   ↓
Disapproved / Closed

RMA Status (Independent)

• RMA Received
• RMA Not Received
```

The **RMA Status** should function independently from the primary request status and should be represented as its own table column and filter category rather than as a dashboard status card.
