# Dashboard Enhancement Specification

## Scope

This update affects the following dashboards:

- `index.html` (Main RMA Dashboard)
- `team-support-dashboard.html` (Support Dashboard)

The objective is to improve the request lifecycle, simplify status management, prepare the application for future API integration, and keep all existing functionality intact unless explicitly stated otherwise.

---

# Main Dashboard (`index.html`)

---

## 1. Dashboard Status Cards

### Replace **Open** with **New Request**

The existing **Open** dashboard card should be removed and replaced with a **New Request** dashboard card.

### New Request Logic

A request should be considered a **New Request** immediately after it is created from:

- `customer.html`
- Any future API endpoint that creates a request

When a new request is created:

- **Total Requests** increases by **1**
- **New Request** increases by **1**

This implementation must:

- work throughout the application
- remain compatible with future API integration
- avoid breaking any existing functionality

---

### Open Status

The **Open** status must **NOT** be removed from the application.

It should still exist inside the **View Request** panel as one of the available request statuses.

Only the **Open dashboard card** is being removed.

---

### Add Disapproved Dashboard Card

Introduce a new dashboard card:

- **Disapproved**

Whenever an administrator changes a request status to **Disapproved**:

- the request should appear under the Disapproved count
- dashboard statistics should update automatically

---

## Final Dashboard Cards

The dashboard should display:

1. Total Requests
2. New Request
3. Pending
4. Pending From Customer
5. Pending From Fastech
6. Pending From OEM
7. Closed
8. Disapproved

---

# 2. RMA Request Table

---

## Rename Column

Rename

```
RMA Issued Date
```

to

```
RMA Date
```

This change must also be reflected inside the **Export to CSV** feature.

---

## Replace Approved with Disapproved

The application will no longer use the **Approved** request state.

Update every location where **Approved** exists.

Replace it with:

```
Disapproved
```

so when the admin manually disapprove the request the request is considred as an disapproved request. (view requesrt panel helps make the request disapprove).
This includes:

- request status
- table display
- filtering
- statistics
- export functionality

---

## Update Filter Tabs

Current filters:

- Open
- Pending
- Approved
- Closed

Updated filters:

- Open
- Pending
- Disapproved
- Closed

Filtering logic should continue working exactly as before.

---

# 3. View Request Panel

---

## Move Request Update Section

The section containing the three status controls should be moved.

Current location:

- lower section of the panel

New location:

- directly below the **Product & Service Information** section

Only the position changes.

No existing functionality should be modified.

---

## Rename Status Labels

Rename the fields as follows:

| Current Label | New Label              |
| ------------- | ---------------------- |
| Status        | **RMA Status**         |
| Pending From  | **RMA Pending Status** |
| Custom Status | **RMA Current Status** |

Only the labels change.

The underlying functionality should remain unchanged.

---

# 4. Export to CSV

The current CSV export contains several internal fields that are no longer required.

Remove unnecessary columns such as:

- Serial Single
- Serial Base Unit
- Serial RF Cable
- Serial Antenna
- Forwarded Field

(Any other obsolete internal fields may also be removed if they are not visible in the View Request panel.)

---

## Export All Relevant Request Details

The CSV export should instead contain every field that is visible inside the **View Request** panel.

The goal is for the exported CSV to represent the complete request details without including unnecessary internal fields.

---

# 5. RMA Number Generation

The current RMA generation logic creates random RMA numbers.

Replace this with sequential numbering.

Example:

```
00001
00002
00003
00004
00005
...
```

Requirements:

- always increment by one
- preserve leading zeros
- never generate duplicate numbers
- remain compatible with future database/API implementation

> **Note:** Existing table sorting logic is already correct and should not be modified.

---

# Support Dashboard (`team-support-dashboard.html`)

---

# 1. View Request Panel

## Remove Approval Email Workflow

Remove the existing:

- Approve
- Disapprove

email actions.

These approval emails are no longer required.

---

## Add Ticket Closed Workflow

Introduce a new action:

```
Ticket Closed
```

When an administrator clicks **Ticket Closed**:

1. Mark the support ticket as closed.
2. Send an email notification to the customer confirming that their support ticket has been successfully resolved and closed.
3. Reuse the existing email infrastructure already implemented within the application.
4. Ensure future API compatibility.

---

## Assigned To Section

Rename:

```
Assigned To
```

to

```
Assigned To Team
```

Add a new input directly below it:

```
Assigned Name
```

The final fields should be:

- Assigned To Team
- Assigned Name

---

## Export to CSV

Update the Support Dashboard CSV export so it includes:

- Assigned To Team
- Assigned Name

Ensure the exported data matches the updated View Request panel.

---

# General Requirements

The following requirements apply to **all** changes described above.

- Do **not** break any existing functionality.
- Preserve all current workflows unless explicitly modified.
- Keep the implementation modular and maintainable.
- Ensure compatibility with future backend/API integration.
- Maintain existing sorting behavior.
- Update all related counters, filters, exports, and UI components so they remain synchronized across the application.
- Ensure all dashboard statistics update automatically whenever request statuses change.
