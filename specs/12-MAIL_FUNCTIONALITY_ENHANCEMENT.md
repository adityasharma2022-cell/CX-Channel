# Mail Functionality Enhancement & Implementation Specification

## Overview

This update focuses on enhancing and standardizing the **email functionality** across the RMA system.

Email notifications should be triggered at the appropriate stages of the RMA lifecycle:

1. **Customer submits a new RMA request**
2. **Admin approves the request**
3. **Admin disapproves the request**

The emails should contain the relevant request information based on the `serviceType`, `typeofOem`, request status, and available request data.

---

# 1. Customer Portal — `customer.html`

## 1.1 Email on Request Submission

The Customer Portal must have email functionality integrated into the **Submit** action.

When a customer successfully submits an RMA request, an email should automatically be sent to the customer's email address.

The email content should depend on the selected `serviceType`.

---

## 1.2 Non-Support Service Requests

### Condition

```js
serviceType !== "support";
```

For all service types other than `support`, the customer should receive a **simple request-submission confirmation email**.

The email should contain:

- Customer name
- Request submission confirmation
- TMI ID generated for the request
- Submission date
- OEM Type (`typeofOem`)
- Selected service type
- Any other important basic request information

### Important

The `typeofOem` value must always be included in the request and email.

The customer should be required to select the OEM type while submitting the request so that the email always contains the correct OEM information.

### Example

**Subject:**

```text
RMA Request Submitted Successfully - TMI ID: TMI12345
```

**Body:**

```text
Hello JAVED SHAIKH,

Your RMA request has been successfully submitted.

TMI ID: TMI12345
Date of Submission: 28-07-2026
OEM: Narda
Service Type: Repair

Our team will review your request and update you once the request has been processed.

Regards,
Fastech Telecommunications (India) Pvt. Ltd.
```

---

# 1.3 Support Service Requests

### Condition

```js
serviceType === "support";
```

For support requests, the confirmation email should contain **all information submitted by the customer**.

The email must include:

- TMI ID
- Submission date
- OEM Type
- Service Type
- Customer name
- Contact number
- Company name
- Designation
- Department/Circle
- Email
- Company address
- Bill-to address
- Return address
- Product model
- Base unit
- Antenna/Probe
- Other product information
- Description of the issue
- Any additional fields submitted through the customer portal

### Example Subject

```text
Support Request Submitted - TMI ID: TMI12345
```

The body should present the submitted information in a clean and readable format.

---

# 2. Admin / Team Portal — `index.html`

The Admin/Team Portal is responsible for reviewing and processing customer RMA requests.

When an administrator changes the request status to either:

- **Approved**
- **Disapproved**

the customer must automatically receive an email notification.

---

# 2.1 Request Approval Email

When the admin **approves** an RMA request, an approval email must be sent to the customer's registered email address.

The approval email should contain:

- Customer name
- Approval confirmation
- RMA Number
- TMI ID
- Date of Request
- OEM
- Request Type / Service Type
- Status
- Status Notes
- Description of Issue
- Sender's Full Name
- Sender's Contact Number
- Sender's Company Name
- Sender's Designation
- Sender's Department/Circle
- Sender's Email
- Sender's Company Address
- Product Model
- Base Unit
- Antenna/Probe
- Others
- Bill-to Address
- Return Address
- Fastech material shipping/return address
- Company contact information
- Signature / Regards section

---

## 2.2 Approval Email Format

The approval email should follow a professional format similar to the following:

### Subject

```text
RMA Request Approved - RMA Number: 11458
```

### Body

```text
Hello JAVED SHAIKH,

Your RMA Request has been approved.

The RMA Number assigned to your request is:

RMA Number: 11458


MATERIAL TO BE SENT TO:

Fastech Telecommunications (India) Pvt. Ltd.
FASTECH PARAM
EL-44, Electronic Zone, TTC Industrial Area
MIDC, Mahape, Navi Mumbai - 400710

Tel. No.: 022-28353636 Ext. 112
GST No.: 27AAACF4021B1ZE


REQUEST DETAILS

Date of Request:
28-07-2026

TMI ID:
TMI12345

RMA Number:
11458

OEM:
Narda

Type:
Repair

Status:
Approved

Status Notes:
Approved by Admin


DESCRIPTION OF THE ISSUE

connection issue


CUSTOMER DETAILS

Sender's Full Name:
JAVED SHAIKH

Sender's Contact No:
8511101489

Sender's Company Name:
Teleysia Networks PVT LTD

Sender's Designation:
Store Head

Sender's Department/Circle:
Inventory Department/GUJARAT

Email:
stores-guj@teleysia.com

Sender's Company Address:
Teleysia Networks Pvt. Ltd.
3rd Floor, 314, Indraprasth Business Park,
Near DAV International School,
Off S.G. Highway, Makarba,
Ahmedabad - 380051


PRODUCT DETAILS

Product Model:
SRM3006

Base Unit:
NA

Antenna/Probe:
H-0657

Others:
N/A


BILL-TO ADDRESS

Teleysia Networks Pvt. Ltd.
3rd Floor, 314, Indraprasth Business Park,
Near DAV International School,
Off S.G. Highway, Makarba,
Ahmedabad - 380051


RETURN ADDRESS

Teleysia Networks Pvt. Ltd.
3rd Floor, 314, Indraprasth Business Park,
Near DAV International School,
Off S.G. Highway, Makarba,
Ahmedabad - 380051


Please refer to the attached RMA instruction document for further instructions regarding the return/shipment process.

Regards,

Aditya Sharma
Fastech Telecommunications (India) Pvt. Ltd.
```

---

# 2.3 Approval Email Attachments

The approval email should support attachments.

### Required Attachment

The following PDF should be attached to the approval email:

```text
/specs/instruction.pdf
```

This document contains the instructions that the customer needs to follow after the RMA request has been approved.

### Future Image Attachment

The approval email may also contain the following image:

```text
cid:image001.jpg@01DBF666.41D5A860
```

The image attachment should be implemented in a way that allows the actual image file to be added/configured later.

If the image is embedded inside the email body, it should preferably use a **CID (`Content-ID`) attachment** so that it renders correctly in supported email clients.

---

# 3. Request Disapproval Email

When the administrator **disapproves** an RMA request, the customer must automatically receive a disapproval notification.

The email should clearly communicate:

- Customer name
- RMA/TMI request identification
- Disapproval status
- Admin's disapproval note/reason
- Any additional instructions provided by the administrator

---

## 3.1 Disapproval Email Format

### Subject

```text
RMA Request Disapproved - TMI ID: TMI12345
```

### Body

```text
Hello Sambit Kumar Acharya,

Your RMA request has been disapproved.

TMI ID:
TMI12345

Status:
Disapproved

Admin Note:
Double request. Please do not submit a duplicate request for the same TMI.

If you believe this request was disapproved incorrectly, please contact the Fastech RMA team for further assistance.

Regards,

Aditya Sharma
Fastech Telecommunications (India) Pvt. Ltd.
```

---

# 4. Email Trigger Flow

The overall email flow should work as follows:

```text
                    CUSTOMER
                       |
                       v
              Submit RMA Request
                       |
                       v
              Generate TMI Number
                       |
                       v
              Save Request Data
                       |
                       v
              Send Submission Email
                       |
             +---------+---------+
             |                   |
             v                   v
       serviceType          serviceType
       !== "support"        === "support"
             |                   |
             v                   v
      Simple Confirmation   Full Request Details
             |                   |
             +---------+---------+
                       |
                       v
                ADMIN PORTAL
                 index.html
                       |
              Admin Reviews Request
                       |
             +---------+---------+
             |                   |
             v                   v
          APPROVE             DISAPPROVE
             |                   |
             v                   v
      Generate/Assign        Save Admin Note
       RMA Number                 |
             |                    |
             v                    v
       Approval Email       Disapproval Email
             |                    |
             v                    v
       Attach PDF            Send to Customer
    instruction.pdf
             |
             v
       Send to Customer
```

---

# 5. Data Requirements

The email functionality should use the **actual request object/data stored by the application** rather than hardcoded values.

At minimum, the email-generation logic should have access to:

```js
{
  (tmiId,
    rmaNumber,
    submissionDate,
    serviceType,
    typeofOem,
    status,
    statusNotes,
    customerName,
    contactNumber,
    companyName,
    designation,
    department,
    email,
    companyAddress,
    productModel,
    baseUnit,
    antennaProbe,
    others,
    billToAddress,
    returnAddress,
    issueDescription);
}
```

The implementation should dynamically populate the email using the request data.

---

# 6. Status-Based Email Rules

| Event                       | Email                                 | Recipient | Attachment        |
| --------------------------- | ------------------------------------- | --------- | ----------------- |
| Customer submits request    | Submission confirmation               | Customer  | None              |
| `serviceType !== "support"` | Simple confirmation + TMI             | Customer  | None              |
| `serviceType === "support"` | Full request details                  | Customer  | None              |
| Admin approves              | Approval notification + RMA details   | Customer  | `instruction.pdf` |
| Admin disapproves           | Disapproval notification + admin note | Customer  | None              |

---

# 7. Important Implementation Requirements

### 7.1 Do Not Send Email Before Request Creation

The system should first:

1. Validate the request.
2. Generate the TMI ID.
3. Save the request successfully.
4. Only then trigger the submission email.

This prevents emails from being sent for requests that were not successfully stored.

---

### 7.2 Approval Email Must Use the Final RMA Number

The approval email must contain the actual RMA number generated/assigned by the admin.

For example:

```text
RMA Number: 11458
```

This value must not be hardcoded.

---

### 7.3 Disapproval Must Include Admin Notes

The admin's disapproval reason should be stored with the request and included in the email.

For example:

```text
Admin Note:
Double request. Please do not submit a duplicate request for the same TMI.
```

---

### 7.4 OEM Type Is Mandatory

The `typeofOem` field should be included in the customer submission flow.

The customer should select the OEM type before submitting the request.

The selected OEM should then be:

```text
Customer Form
      ↓
Request Object
      ↓
Database / Storage
      ↓
Admin Portal
      ↓
Email
```

The same OEM value should be displayed consistently throughout the RMA lifecycle.

---

### 7.5 Email Failure Should Not Corrupt the RMA Request

The request should already be saved before attempting to send the email.

If the email fails:

```text
Request Saved
      |
      +----> Email Sent Successfully
      |
      +----> Email Failed
                 |
                 v
           Log the Error
```

The system should not delete or roll back a valid RMA request simply because the email service temporarily failed.

Email failures should be logged so they can be retried or investigated.

---

# 8. Files Involved

### Customer Portal

```text
/customer.html
```

Responsible for:

- Customer request submission
- TMI generation/request creation
- Submission email trigger
- OEM selection
- Support/non-support email behavior

### Admin Portal

```text
/index.html
```

Responsible for:

- Viewing requests
- Approving requests
- Disapproving requests
- Adding admin/status notes
- Assigning RMA number
- Triggering approval/disapproval emails

### Email Instruction Document

```text
/specs/instruction.pdf
```

Used as an attachment for the **approval email**.

---

# 9. Final Expected Behavior

The final implementation should provide the following experience:

### Customer submits request

```text
Customer
   ↓
Submit Request
   ↓
TMI Generated
   ↓
Request Saved
   ↓
Customer receives confirmation email
```

For normal services:

```text
Simple confirmation
+ TMI ID
+ Date
+ OEM
+ Service Type
```

For support:

```text
Complete submitted request information
+ TMI ID
+ Date
+ OEM
+ Service Type
```

### Admin approves

```text
Admin
  ↓
Approve Request
  ↓
RMA Number Assigned
  ↓
Customer receives approval email
  ↓
instruction.pdf attached
```

### Admin disapproves

```text
Admin
  ↓
Disapprove Request
  ↓
Admin Note Saved
  ↓
Customer receives disapproval email
  ↓
Disapproval reason displayed
```

The objective is to make the RMA email system **consistent, dynamic, traceable, and fully integrated with the existing request lifecycle**, without hardcoding customer, TMI, RMA, OEM, or request-specific information.
