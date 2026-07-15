# Support Portal Updates (HTML + API)

## Objective

Implement the following updates across the Support Portal. All frontend, backend, API routes, validation, database handling, rendering logic, email templates, and CSV export functionality should remain fully synchronized. Avoid implementing one-off fixes; instead, make the application flexible enough that these changes are reflected consistently throughout the entire system.

---

# 1. Customer Portal (`customer.html`)

## 1.1 Make "Description of the Problem" Optional

### Current Behavior

The **Description of the Problem** field is required when submitting a Support request.

### Required Changes

- Make the field completely optional.
- Users should be able to submit a Support request without entering a description.

Update all related components including:

- HTML validation
- JavaScript validation
- API request handling
- Backend validation
- Database/model validation (if applicable)
- Email templates (if applicable)
- Any logic that currently assumes this field is required

The API should successfully process requests even when this field is empty.

---

## 1.2 Remove "Support Subject"

### Current Behavior

When:

```text
serviceType == "Support"
```

an additional field named:

```text
Support Subject
```

is displayed.

### Required Changes

Remove this field completely from the application.

This includes:

- HTML
- JavaScript
- Form validation
- API payload
- Backend validation
- Database/model handling
- Email generation
- Rendering logic
- Any references throughout the application

After these changes, the application should function normally without this field existing anywhere.

---

# 2. Team Support Dashboard (`team-support-dashboard.html`)

## 2.1 Update Dashboard Status Cards

Replace the existing dashboard metrics.

### Current

```
Open
Pending
Approved
Total
```

### Required

```
Total
Open
Closed
```

Remove every other status card.

Ensure the counts are calculated correctly based on the current Support requests.

---

## 2.2 Update Status Filter Tabs

Replace the existing filter buttons.

### Current

```
All
Open
In Progress
Approved
Rejected
Closed
```

### Required

```
All
Open
Closed
```

Filtering should continue to work correctly using only these three options.

---

## 2.3 Fix Initial Table Rendering Bug

### Current Behavior

- The page loads successfully.
- The API request completes successfully.
- The data is fetched correctly.
- However, the table remains empty.
- Clicking the **Open** filter causes the table to render correctly.

### Expected Behavior

Immediately after the API response is received:

- Render the table automatically.
- Display all Support requests.
- Keep **All** as the default active filter.

Investigate and fix the root cause of the rendering/filtering issue rather than implementing a temporary workaround.

---

## 2.4 Simplify Status Dropdown

Inside the Support Request Details modal, update the editable Status dropdown.

### Current

```
Open
In Progress
Approved
Rejected
Closed
```

### Required

```
Open
Closed
```

Remove every other status.

Update all related frontend logic, backend validation, API handling, and database updates so that only these two statuses are supported for Support requests.

---

## 2.5 Add Export to CSV

Add an **Export to CSV** button to the Support Dashboard.

Use the implementation from **Main Dashboard (`index.html`)** as the reference.

### Requirements

The exported CSV should contain exactly the same data currently displayed in the Support Requests table.

Include all visible columns, including:

- Ticket
- Customer 
- OEM / Product	
- Subject	
- Priority
- Status
- Date

Ensure:

- The export format matches the Main Dashboard.
- The exported CSV reflects the currently filtered dataset.
- Filtering (All/Open/Closed) is respected during export.

---

# 3. Application Consistency

Ensure every change is implemented consistently across the application.

This includes, but is not limited to:

- HTML
- CSS (if required)
- JavaScript
- API routes
- Backend validation
- Database models
- Email templates
- CSV export
- Table rendering
- Modal rendering
- Filtering logic
- Status calculations
- Request creation
- Request updates

The application should not contain any leftover references to removed fields or obsolete statuses.

---

# Expected Result

After implementation:

- Description is optional.
- Support Subject has been removed entirely.
- Dashboard cards display only **Total**, **Open**, and **Closed**.
- Status filters display only **All**, **Open**, and **Closed**.
- The Support table renders immediately after loading without requiring user interaction.
- Status editing only supports **Open** and **Closed**.
- Export to CSV works identically to the Main Dashboard.
- All frontend and backend logic remains synchronized with no validation errors or inconsistent behavior.
