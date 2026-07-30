# Main Dashboard Updates (`index.html`)

## Objective

Implement the following updates across the Main Dashboard. Ensure that all frontend components, backend logic, API routes, rendering, status calculations, validation, CSV exports, and database interactions remain fully synchronized. The changes should be integrated cleanly without introducing regressions or breaking existing functionality.

---

# 1. RMA Request Table Ordering

## Current Behavior

Newly created RMA requests are displayed in a non-sequential order.

## Required Changes

Display the newest requests at the **top** of the RMA Request table.

### Expected Behavior

- Newly submitted requests should always appear as the first row.
- Older requests should follow below in chronological order.
- This ordering should remain consistent after:
  - Page refresh
  - Filtering
  - Status updates
  - Any data reload from the API

---

# 2. Update Dashboard Status Cards

Replace the existing dashboard status cards.

## Current

```text
Pending
Forwarded
Approved
Closed
Rejected
```

## Required

```text
Total Requests
Open
Pending
Pending From Customer
Pending From Fastech
Closed
```

### Requirements

- Remove the existing **Forwarded**, **Approved**, and **Rejected** cards.
- Add the new cards:
  - Total Requests
  - Open
  - Pending
  - Pending From Customer
  - Pending From Fastech
  - Closed

- Ensure every card displays the correct count based on the current request data.
- Dashboard statistics should update automatically whenever a request is created or its status changes.

---

# 3. Request Details Modal Improvements

When clicking **View Request**, update the layout and functionality of the Request Details modal.

---

## 3.1 Rearrange Investigation & Repair Fields

### Current Layout

The **Investigation Details** and **Repair Details** fields are positioned separately from the Investigation Date.

### Required Changes

Move the following fields so they appear together:

- Date of Investigation
- Investigation Details
- Repair Details

### Expected Layout

These three fields should be grouped within the same section to improve readability and workflow.

The layout should remain:

- Clean
- Responsive
- Properly aligned
- Consistent with the rest of the dashboard

---

## 3.2 Dashboard Card Synchronization

Currently the following statuses exist:

- Pending From Customer
- Pending From Fastech

These statuses should also be reflected in the dashboard cards.

### Requirements

Whenever a request is updated to either:

```text
Pending From Customer
```

or

```text
Pending From Fastech
```

the corresponding dashboard card should immediately update.

The dashboard should accurately display:

```text
Total Requests
Open
Pending
Pending From Customer
Pending From Fastech
Closed
```

Counts should remain correct after:

- Page refresh
- API reload
- Status changes
- Editing requests

---

## 3.3 Replace "Forwarded To" Field

### Current

The Request Details modal contains a field named:

```text
Forwarded To
```

### Required Changes

Remove this field completely.

Replace it with a new field:

```text
Status
```

---

### New Status Options

The new Status dropdown should contain only:

```text
Open
Pending
Approved
Closed
```

---

### Existing Pending Status Handling

The application already contains additional Pending-related dropdowns for:

- Pending From Customer
- Pending From Fastech

These should remain available and continue functioning.

The new Status dropdown should work alongside these fields without replacing them.

Example workflow:

- Status = Open
- Status = Pending
  - Pending Type = Pending From Customer
  - Pending Type = Pending From Fastech

- Status = Approved
- Status = Closed

Ensure the UI clearly represents this relationship and avoids conflicting states.

---

# 4. Application Consistency

Implement these changes consistently across the entire application.

This includes:

- HTML
- CSS (where required)
- JavaScript
- API routes
- Backend validation
- Database models
- Request update logic
- Dashboard rendering
- Modal rendering
- Status calculations
- Filtering
- CSV exports
- Email notifications (if applicable)
- Any business logic related to request status

Avoid leaving obsolete references to removed fields such as **Forwarded To** or outdated dashboard status cards.

---

# Expected Result

After implementation:

- New RMA requests appear at the top of the table.
- Dashboard cards display:
  - Total Requests
  - Open
  - Pending
  - Pending From Customer
  - Pending From Fastech
  - Closed

- Investigation Date, Investigation Details, and Repair Details are grouped together in the Request Details modal.
- Pending From Customer and Pending From Fastech correctly update the dashboard metrics.
- The **Forwarded To** field has been removed.
- A new **Status** dropdown supports:
  - Open
  - Pending
  - Approved
  - Closed

- Pending sub-statuses continue to function correctly.
- All frontend and backend logic remains synchronized, with no broken workflows or inconsistent behavior across the application.

---

# 5. Request Details UI Consistency

Update the typography and presentation of field labels inside the **View Request** modal.

## Current Behavior

Field titles/labels are displayed using uppercase styling (or all capital letters), making the interface look inconsistent and harder to read.

Examples:

```text
CUSTOMER NAME
DATE OF INVESTIGATION
INVESTIGATION DETAILS
REPAIR DETAILS
BILLING ADDRESS
RETURN ADDRESS
```

## Required Changes

Update all field labels to use **sentence/title case**, where **only the first letter of each word is capitalized**.

Examples:

```text
Customer Name
Date of Investigation
Investigation Details
Repair Details
Billing Address
Return Address
```

### Requirements

- Apply this consistently to **every field title** inside the **View Request** modal.
- Do **not** use ALL CAPS or uppercase text transformations.
- Maintain consistent font size, spacing, alignment, and typography throughout the modal.
- Ensure the styling looks clean, modern, and professional while remaining consistent with the rest of the dashboard.

This change should affect **only the field labels/titles**, not the actual data values entered by users.
