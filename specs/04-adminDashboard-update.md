# Team Dashboard Updates (`team-dashboard.html`)

## Objective

Update the existing **Main Dashboard (`team-dashboard.html`)** by modifying the status management, RMA Request table, CSV export, and View Request UI while preserving all existing functionality.

---

## General Requirements

- Preserve all existing functionality unless explicitly mentioned.
- Do **not** modify any backend APIs unless absolutely necessary.
- Do **not** modify the email sending functionality.
- Follow the existing UI styling and component design.
- Ensure all updates remain responsive.
- Do not introduce breaking changes.

---

# 1. Dashboard Status Cards

## Current

The dashboard currently displays the following status cards:

- Total Requests
- Pending For Customer
- Pending For Fastech
- Forwarded
- Finalized

## Required

Replace the existing cards with the following status cards:

- Pending
- Forwarded
- Approved
- Closed
- Rejected

### Requirements

- Update all dashboard counters accordingly.
- Remove obsolete status cards.
- Maintain the existing responsive layout.
- Ensure the cards remain visually aligned with the rest of the dashboard.

---

# 2. Request Status Update

## Current

Inside the **View Request** modal there are currently **two separate status dropdowns**.

## Required

Replace the two dropdowns with a **single Status dropdown**.

### Allowed Status Values

- Pending from Customer
- Pending from Fastech

### Requirements

- Remove the old dropdowns.
- Only one status selector should exist.
- Keep the current update workflow intact.
- Maintain existing styling and layout.

---

# 3. RMA Request Table Update

## Remove

Remove the following column:

- Notes

## Preserve

Keep every other table column exactly as it currently exists.

Do **not** modify:

- Sorting
- Pagination
- Search
- Filters
- Row actions
- Existing table styling

---

# 4. Export to CSV Update

## Current

The CSV export currently contains additional fields that are not part of the RMA Request table.

## Required

Update the export functionality so that the CSV contains **only the fields displayed in the RMA Request table**.

### Requirements

- Remove all extra exported fields.
- Export only the columns currently visible in the RMA Request table.
- Ensure the exported column order matches the table order.
- Preserve the existing export functionality.

---

# 5. Extend the View Request Screen

## Important

This task is **UI only**.

Do **not** modify:

- Backend logic
- Email functionality
- Database schema
- Existing request processing workflow

---

## Current

Clicking the **View** button opens the customer/request details.

## Required

Below the existing customer details section, create a **new section**.

Suggested section title:

> **Internal Processing Details**

or

> **Service Investigation Details**

Use whichever better matches the current application.

---

## Add the Following Fields

Add UI inputs/placeholders for:

- Admin Note
- Received Date
- Date of Investigation
- Warranty
- Investigation Details
- Repair Details
- Estimate Date
- Estimate Number
- Estimate Amount (INR)
- P.O. No. & Date
- PO Received Date
- OEM RMA No.
- Date of Sent
- Platform / Module
- OEM Quotation
- Date of Receiving from OEM
- DC No. & Date
- Dispatched Date
- LR No.
- Reason for Waiting
- Delivered Date
- Ack. Date from WH
- Remark

---

## Field Types

| Field | Input Type |
|---------|------------|
| Admin Note | Textarea |
| Investigation Details | Textarea |
| Repair Details | Textarea |
| Reason for Waiting | Textarea |
| Remark | Textarea |
| Warranty | Dropdown or Text |
| Estimate Amount (INR) | Number |
| All Date Fields | Date Picker |
| Remaining Fields | Text Input |

---

## UI Requirements

- Follow the existing dashboard styling.
- Group related fields together.
- Use a responsive two-column layout where appropriate.
- Textareas should span the full width.
- Maintain consistent spacing, typography, and alignment.
- Ensure labels are consistent with the rest of the application.

---

# Acceptance Criteria

- Dashboard status cards display:
  - Pending
  - Forwarded
  - Approved
  - Closed
  - Rejected

- View Request contains a single Status dropdown.

- Status dropdown supports:
  - Pending from Customer
  - Pending from Fastech
 
- Notes column is removed from the RMA Request table.

- CSV export contains only the RMA Request table columns.

- View Request screen includes the new **Internal Processing Details** section with all requested fields.

- No existing functionality is broken.

- Email functionality remains unchanged.

- Backend behavior remains unchanged unless required to support the new status values.

---