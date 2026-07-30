# Customer Portal - New Features

Implement the following enhancements to the Customer Portal.

---

# 1. Add Location Input

## Requirements

Add a new input field named **Location** in `customer.html`.

### Placement
- Position it beside the **Designation** input.
- It should appear below the **Company** input.
- Match the existing styling and responsive layout.

No backend changes are required if the location field is already supported. Otherwise, include it in the request payload and persist it with the request.

---

# 2. Add PO Details for Calibration Requests

PO details should only be visible when:

```
serviceType === "calibration"
```

## Display the following fields

- PO Number
- PO Date

### Behaviour
- these are optional fields
- Hide both fields for every other service type.
- Show both fields immediately when the user selects **Calibration**.
- Include these values in the submitted request only for calibration requests.
- Store them with the request.

---

# 3. OEM Product Search & Select

## Objective

Replace the existing Product Model text input with a searchable dropdown.

The user should **search and select** an existing product model instead of typing it manually.

This should behave similarly to:

- React Select
- Select2
- VS Code Command Palette

It is **not** a free-text search.

---

## Workflow

### Step 1

User selects an OEM.

Available OEMs:

- NARDA
- VeEX
- Cubro
- ATDI
- Others

---

### Step 2

After selecting an OEM:

Display a searchable Product Model field.

Example:

```
OEM:
[NARDA ▼]

Product Model:
[ Search model... ]

SRM-3006
NBM-520
Signal Shark
Smart AMC
...
```

The list should filter as the user types.

---

### Step 3

The user selects one model from the list.

Only one model can be selected.

The selected value is submitted with the request.

---

## OEM Model Mapping

Use the attached OEM product list as the source of truth.

The available models are grouped by OEM.

Example:

### NARDA

- SRM-3006
- NBM-520
- NBM-550
- Field Man
- Smart AMC
- Signal Shark
- RadMan2
- Nardalert S3
- EHP-50F
- HP-01
- ...

### VeEX

- MTTplus-410
- FX40-OLS
- FX150+
- TX300s OTDR
- RXT-4100+
- FX81
- RTU-4100
- MTX642
- WX90
- VeSion
- ...

### Cubro

- EXA48800
- EXA48200
- EXA32400
- EXA64100
- Aggregator C400/64/48/32
- EX6-3
- EX5-3
- ...

### ATDI

- HTZ Communications
- ICS Manager
- HTZ Warfare
- HTZ Analyzer

Use the complete list provided in the attached document. Do not omit any models. :contentReference[oaicite:1]{index=1}

---

## "Others" Option

If the user selects **Others**:

- Hide the searchable model selector.
- Display a normal text input labelled:

```
Enter Product Model
```

The user can manually enter any model name.

---

# UI Requirements

- Keep the existing form layout.
- Maintain the current styling.
- Use the existing validation patterns.
- Do not redesign the page.

---

# Submission Requirements

Submitted request should include:

- Location
- PO Number (Calibration only)
- PO Date (Calibration only)
- OEM
- Product Model

---

# Acceptance Criteria

- Location field added.
- PO Number and PO Date appear only for Calibration requests.
- Product Model becomes a searchable select.
- Search filters models in real time.
- User selects exactly one model.
- Model list changes according to the selected OEM.
- "Others" allows manual model entry.
- Existing functionality remains unchanged.