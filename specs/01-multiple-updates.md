# Customer Portal & Dashboard Updates

## Overview

Implement the following updates across the Customer Portal, RMA Dashboard, and Support Dashboard.

---

# 1. Support Dashboard

## Fetch Support Requests

Currently, the Support Dashboard should display support requests submitted by customers.

### Requirements

- Integrate the API call to fetch `support.json`.
- If the API route does not already exist:
  - Implement it.
  - Follow the existing implementation used for fetching `request.json`.
  - Maintain the same coding style, response structure, and error handling.

No UI redesign is required.

I may think that that the support dashboard may not be using the session from the main dashboard as the sidebar displays an hardcoded user signed in no the actual user signing in 

---

# 2. RMA Number Generation

## Current Problem

The RMA number is currently generated when a customer submits a request.

This behavior must be changed.

## New Behaviour

The RMA number should **NOT** be generated during customer submission.

Instead:

1. Customer submits any request
   - Service Request
   - Support Request
   - Any future request type

2. Admin receives the notification email (existing behaviour).

3. The request appears in the dashboard.

4. When the admin approves the request (when we view the request there is an option for approving the request or rejecting the request the RMA number should be generated on the approval of the request and also cutomer should be mailed) :
   - Generate the RMA number.
   - Persist the generated RMA.
   - Send the approval email to the customer (existing behaviour).

### Dashboard Behaviour

Do **not** modify the dashboard table.

The RMA column should continue to exist.

If the request has not yet been approved:

- RMA Number = empty / null / blank

Once approved:

- Display the generated RMA number.

---

# 3. View Request

Apply the following changes to **both**:

- RMA Request Dashboard
- Support Dashboard

## Remove Sections

Completely remove the following sections:

- Customer History
- Internal Notes
- Customer Feedback

These should no longer be displayed anywhere inside the View Request modal/page.

---

## Status Update

Replace the single Status dropdown.

Instead create two independent dropdowns:

- Pending For Customer
- Pending For Fastech

These new statuses should be fully supported throughout the application.

---

# 4. Dashboard Statistics Cards

Update the statistics cards displayed on the RMA Request Dashboard.

## Current

- Total Requests
- Pending
- Forwarded
- Finalised

## New

- Total Requests
- Pending For Customer
- Pending For Fastech
- Forwarded
- Finalised

The counts should reflect the updated status values.

---

# Important

## Preserve Existing Functionality

Do **not** change or break the following existing behaviour:

- Customer submission flow
- Admin email on new request
- Customer email after approval
- Existing dashboard layout (except the requested changes)
- Existing API response structure
- Existing approval workflow

Only implement the changes described above.

---

# Acceptance Criteria

- Support Dashboard fetches data from `support.json`.
- Missing API route is implemented using the existing `request.json` implementation as a reference.
- RMA number is generated **only** after admin approval.
- Dashboard displays an empty RMA field until approval.
- View Request no longer contains:
  - Customer History
  - Internal Notes
  - Customer Feedback
- Status dropdown is replaced with:
  - Pending For Customer
  - Pending For Fastech
- Dashboard statistics display:
  - Total Requests
  - Pending For Customer
  - Pending For Fastech
  - Forwarded
  - Finalised
- Existing email workflow remains unchanged.