# New Feature: Add Support Tab to Customer Portal

## Objective

Enhance the customer portal (`customer.html`) by introducing a new **Support** tab while keeping the existing **Service Request** functionality unchanged.

## Requirements

### 1. Add Tab Navigation

Currently, the customer portal only contains a single form for creating a Service Request.

Implement a tab-based interface with two tabs:

* **Service Request**
* **Support**

The **Service Request** tab should remain the default selected tab when the page loads.

---

### 2. Preserve Existing Service Request Form

Do **not** modify the existing Service Request form.

The current form should remain exactly as it is, including:

* Layout
* Styling
* Validation
* Input fields
* Submit functionality
* API integration
* Event listeners

No existing functionality should break.

---

### 3. Create Support Form

The **Support** tab should display a separate form.

For now, duplicate the existing Service Request form exactly so both forms have the same structure, styling, and behavior.

The only differences should be:

* The form belongs to the **Support** tab.
* The submit action should identify the request as a **Support** request (either by sending a `type: "support"` field or using a separate endpoint, depending on the existing architecture).

---

### 4. Tab Behavior

When the user clicks:

* **Service Request** → display the Service Request form and hide the Support form.
* **Support** → display the Support form and hide the Service Request form.

Switching tabs should not reload the page.

---

### 5. UI Consistency

Maintain the existing design language.

The new tab navigation should match the current UI theme, including:

* Colors
* Fonts
* Spacing
* Border radius
* Hover effects
* Active tab styling

The Support tab should feel like a native part of the existing interface.

---

### 6. Code Quality

* Reuse existing components where possible.
* Avoid duplicating JavaScript logic unnecessarily.
* Keep the code modular and maintainable.
* Do not introduce breaking changes.

---

## Expected Result

The customer portal should contain two tabs:

1. **Service Request**

   * Displays the existing request form.
   * Works exactly as before.

2. **Support**

   * Displays an identical form.
   * Used specifically for customer support requests.

The user should be able to switch between the two tabs seamlessly without affecting existing functionality.
