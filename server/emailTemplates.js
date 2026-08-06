require("dotenv").config({ path: __dirname + "/.env" });
const fs = require("fs");
const path = require("path");

const COMPANY = {
  name: "Fastech Telecommunications (India) Pvt. Ltd.",
  addressLines: [
    "FASTECH PARAM",
    "EL-44, Electronic Zone, TTC Industrial Area",
    "MIDC, Mahape, Navi Mumbai - 400710",
  ],
  phone: "022-28353636 Ext. 112",
  gst: "27AAACF4021B1ZE",
};

const INSTRUCTION_PDF = path.resolve(
  __dirname,
  "..",
  "specs",
  "instruction.pdf",
);

const escHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const displayRma = (rmaNumber) =>
  rmaNumber ? String(rmaNumber).replace(/^(?:T-|RMA-)/i, "") : "";

function formatDate(value) {
  if (!value) return "";
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}-${m[3]}` : s;
}

function signature(opts = {}) {
  const name = opts.senderName || process.env.MAIL_SIGNER_NAME || "";
  return { name: name || "Fastech RMA Team", company: COMPANY.name };
}

function textToHtml(text) {
  return String(text)
    .split(/\n\s*\n/)
    .filter((b) => b.trim())
    .map((block) => `<p>${block.split("\n").map(escHtml).join("<br/>")}</p>`)
    .join("\n");
}

// Each field renders as its own block (label above value). Blocks are laid
// out two-per-row inside an invisible table so multiple fields sit side by
// side, spaced apart, with no borders or colors.
// (Used by the support-request email, which keeps the label-above-value style.)
function fieldCell(label, value) {
  return `<td style="padding:4px 20px 4px 0;vertical-align:top;width:50%;">
      <div style="font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px;">${escHtml(label)}</div>
      <div style="word-break:break-word;">${escHtml(value || "-")}</div>
    </td>`;
}

// Pairs the given field cells into rows of two columns.
function gridHtml(cells) {
  let rows = "";
  for (let i = 0; i < cells.length; i += 2) {
    rows += `<tr>${cells[i]}${cells[i + 1] || '<td style="width:50%;"></td>'}</tr>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border:0;">${rows}</table>`;
}

function h4(title) {
  return `<h4 style="margin:16px 0 6px;font-size:15px;">${escHtml(title)}</h4>`;
}

// Escapes user-provided content.
function para(value) {
  return `<p style="margin:2px 0;line-height:1.5;white-space:pre-wrap;">${escHtml(value || "-")}</p>`;
}

// Static content may contain intentional <br/> tags, so it is NOT escaped.
function rawPara(value) {
  return `<p style="margin:2px 0;line-height:1.5;">${value}</p>`;
}

// --- Flat "Label: Value" row layout used by the approval email ---
// Renders one row with a label+value pair, and optionally a second
// label+value pair beside it on the same line (e.g. "OEM: VeEX   Type: Repair").
function fieldRow(label1, value1, label2, value2) {
  const secondPair = label2
    ? `<td style="padding:4px 8px;font-weight:700;white-space:nowrap;">${escHtml(label2)}</td>
       <td style="padding:4px 0;">${escHtml(value2 || "-")}</td>`
    : `<td colspan="2"></td>`;
  return `<tr>
    <td style="padding:4px 8px 4px 0;font-weight:700;white-space:nowrap;vertical-align:top;">${escHtml(label1)}</td>
    <td style="padding:4px 24px 4px 0;vertical-align:top;">${escHtml(value1 || "-")}</td>
    ${secondPair}
  </tr>`;
}

// For fields like "Description of the Issue" where the value needs the
// full row width (can be long or multi-line).
function fieldRowFull(label, value) {
  return `<tr><td colspan="4" style="padding:8px 0 2px;font-weight:700;">${escHtml(label)}</td></tr>
    <tr><td colspan="4" style="padding:0 0 6px;white-space:pre-wrap;">${escHtml(value || "-")}</td></tr>`;
}

function fieldTable(rows) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;border:0;">${rows.join("")}</table>`;
}

function wrapHtml(title = "", bodyHtml) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    ${title ? `<h3>${escHtml(title)}</h3>` : ""}
    ${bodyHtml}
  </body>
</html>`;
}

function buildMessage(subject, text, includeCidImage) {
  let bodyHtml = textToHtml(text);
  if (includeCidImage) {
    bodyHtml += `<p><img src="cid:image001" alt="Fastech" /></p>`;
  }
  return { subject, text, html: wrapHtml("", bodyHtml) };
}

function buildHtml(title, subject, text, includeCidImage, bodyHtml) {
  let html = bodyHtml || textToHtml(text);
  if (includeCidImage) {
    html += `<p><img src="cid:image001" alt="Fastech" /></p>`;
  }
  return { subject, text, html: wrapHtml(title, html) };
}

function imageAttachment() {
  const imagePath = process.env.MAIL_IMAGE_PATH;
  if (!imagePath || !fs.existsSync(imagePath)) return null;
  return {
    filename: path.basename(imagePath),
    path: imagePath,
    cid: "image001",
  };
}

// The PDF is pushed into `attachments` WITHOUT a `cid`, so it is never
// referenced inside the HTML body. Email clients (Gmail, Outlook, etc.)
// automatically render any attachment that isn't embedded via cid as a
// separate item below the message body — that's what places the PDF
// "below the mail" in the screenshot, with no extra HTML needed for it.
function approvalAttachments() {
  const attachments = [];
  if (fs.existsSync(INSTRUCTION_PDF)) {
    attachments.push({
      filename: "RMA-Shipping-Instructions.pdf",
      path: INSTRUCTION_PDF,
      contentType: "application/pdf",
    });
  }
  const image = imageAttachment();
  if (image) attachments.push(image);
  return attachments;
}

function buildSubmissionEmail(request) {
  const id = request.id || "";
  const subject = `RMA Request Submitted Successfully `;
  const isNarda = String(request.oem || "").toLowerCase() === "narda";
  const isCalibration =
    String(request.serviceType || "").toLowerCase() === "calibration";
  const text = [
    `Hello ${request.name || ""},`,
    "",
    "Your RMA request has been successfully submitted.",
    "",
    `Date of Submission: ${formatDate(request.createdAt)}`,
    `OEM: ${request.oem || ""}`,
    `Service Type: ${request.serviceType || ""}`,
    `Product Model: ${request.product || ""}`,
    ...(isNarda
      ? [
          `Base Unit S/N: ${request.serialBaseUnit || ""}`,
          `RF Cable S/N: ${request.serialRfCable || ""}`,
          `Antenna S/N: ${request.serialAntenna || ""}`,
        ]
      : [`Product Serial Number: ${request.serialSingle || ""}`]),
    ...(isCalibration
      ? [
          `PO Number: ${request.poNumber || ""}`,
          `PO Date: ${formatDate(request.poDate)}`,
        ]
      : []),
    "",
    "Our team will review your request and update you once the request has been processed.",
    "",
  ].join("\n");
  return buildMessage(subject, text, false);
}

function buildAdminSubmissionEmail(request) {
  const id = request.id || "";
  const subject = `RMA Request Submitted Successfully `;
  const isNarda = String(request.oem || "").toLowerCase() === "narda";
  const isCalibration =
    String(request.serviceType || "").toLowerCase() === "calibration";
  const text = [
    "Hello!",
    "",
    `You have a new request for ${request.oem || ""} ${request.serviceType || ""}`,
    "",
    `Date of Submission: ${formatDate(request.createdAt)}`,
    `OEM: ${request.oem || ""}`,
    `Service Type: ${request.serviceType || ""}`,
    `Product Model: ${request.product || ""}`,
    ...(isNarda
      ? [
          `Base Unit S/N: ${request.serialBaseUnit || ""}`,
          `RF Cable S/N: ${request.serialRfCable || ""}`,
          `Antenna S/N: ${request.serialAntenna || ""}`,
        ]
      : [`Product Serial Number: ${request.serialSingle || ""}`]),
    ...(isCalibration
      ? [
          `PO Number: ${request.poNumber || ""}`,
          `PO Date: ${formatDate(request.poDate)}`,
        ]
      : []),
    "",
  ].join("\n");
  return buildMessage(subject, text, false);
}

function buildSupportSubmissionEmail(request) {
  const id = request.id || "";
  const subject = `Support Request Submitted - Ticket ID: ${id}`;
  const text = [
    `Hello ${request.name || ""},`,
    "",
    "Your support request has been successfully submitted. Our team will review your request and update you once the request has been processed.",
    "",
    "Ticket ID:",
    id,
    "",
    "Date of Submission:",
    formatDate(request.createdAt),
    "",
    "OEM:",
    request.oem || "",
    "",
    "Service Type:",
    request.serviceType || "Support",
    "",
    "CUSTOMER DETAILS",
    "",
    "Name:",
    request.name || "",
    "",
    "Contact Number:",
    request.phone || "",
    "",
    "Company Name:",
    request.company || "",
    "",
    "Designation:",
    request.designation || "",
    "",
    "Location:",
    request.location || "",
    "",
    "Email:",
    request.email || "",
    "",
    "Company Address:",
    request.billingAddress || "",
    "",
    "PRODUCT DETAILS",
    "",
    "Product Model:",
    request.product || "",
    "",
    "Software Version:",
    request.softwareVersion || "",
    "",
    "Other Product Information:",
    [
      request.serialRfCable,
      request.serialBaseUnit,
      request.serialSingle,
      request.serialAntenna,
    ]
      .filter(Boolean)
      .join(", ") || "",
    "",
    "DESCRIPTION OF THE ISSUE",
    "",
    request.description || "",
    "",
    "ADDITIONAL INFORMATION",
    "",
    request.additionalInfo || "",
    "",
  ].join("\n");

  const bodyHtml = `
    <p>Hello ${escHtml(request.name || "")},</p>
    <p>Your support request has been successfully submitted. Our team will review your request and update you once the request has been processed.</p>
    ${h4("Request Details")}
    ${gridHtml([
      fieldCell("Ticket ID", id),
      fieldCell("Date of Submission", formatDate(request.createdAt)),
      fieldCell("OEM", request.oem),
      fieldCell("Service Type", request.serviceType || "Support"),
    ])}
    ${h4("Customer Details")}
    ${gridHtml([
      fieldCell("Name", request.name),
      fieldCell("Contact Number", request.phone),
      fieldCell("Company Name", request.company),
      fieldCell("Designation", request.designation),
      fieldCell("Location", request.location),
      fieldCell("Email", request.email),
      fieldCell("Company Address", request.billingAddress),
    ])}
    ${h4("Product Details")}
    ${gridHtml([
      fieldCell("Product Model", request.product),
      fieldCell("Software Version", request.softwareVersion),
      fieldCell(
        "Other Product Information",
        [
          request.serialRfCable,
          request.serialBaseUnit,
          request.serialSingle,
          request.serialAntenna,
        ]
          .filter(Boolean)
          .join(", "),
      ),
    ])}
    ${h4("Description of the Issue")}
    ${para(request.description)}
    ${h4("Additional Information")}
    ${para(request.additionalInfo)}
  `;

  return buildHtml(
    "Support Request Submission",
    subject,
    text,
    false,
    bodyHtml,
  );
}

// Matches the real approval mail layout: flat "Label: Value" rows (two
// label/value pairs per line where the screenshot shows them side by side),
// not the boxed/grouped card style used elsewhere in this file.
function buildApprovalEmail(request, opts = {}) {
  const id = request.id || "";
  const rma = displayRma(request.rmaNumber);
  const requestDate = formatDate(request.createdAt);
  const subject = `RMA Number - ${rma} Date of Request: ${requestDate}`;
  const statusNotes = opts.statusNotes || request.ipAdminNote || "";
  const billTo = request.billingAddress || "";
  const returnTo = request.returnAddress || "";
  const isNarda = String(request.oem || "").toLowerCase() === "narda";
  const isCalibration =
    String(request.serviceType || "").toLowerCase() === "calibration";

  const companyAddressLines = [
    ...COMPANY.addressLines,
    `Te. No. ${COMPANY.phone}`,
    `Our GST No. ${COMPANY.gst}`,
  ];

  const text = [
    `Hello ${request.name || ""}!`,
    `Your RMA Request has been approved and RMA Number for your request is ${rma} .`,
    "",
    "Material to be sent to :",
    COMPANY.name,
    ...companyAddressLines,
    "",
    `Date of Request: ${requestDate}`,
    `RMA Number: ${rma}`,
    `OEM: ${request.oem || ""}`,
    `Type: ${request.serviceType || ""}`,
    `Status: Approved`,
    `Status Notes: ${statusNotes}`,
    "Description of the Issue:",
    request.description || "",
    `Sender's Full Name: ${request.name || ""}`,
    `Sender's Contact No: ${request.phone || ""}`,
    `Sender's Company Name: ${request.company || ""}`,
    `Sender's Designation: ${request.designation || ""}`,
    `Sender's Location: ${request.location || ""}`,
    `Email: ${request.email || ""}`,
    `Sender's Comapny Address: ${billTo}`,
    `Product Model: ${request.product || ""}`,
    ...(isNarda
      ? [
          `Base Unit S/N: ${request.serialBaseUnit || ""}`,
          `RF Cable S/N: ${request.serialRfCable || ""}`,
          `Antenna S/N: ${request.serialAntenna || ""}`,
        ]
      : [`Product Serial Number: ${request.serialSingle || ""}`]),
    ...(isCalibration
      ? [
          `PO Number: ${request.poNumber || ""}`,
          `PO Date: ${formatDate(request.poDate)}`,
        ]
      : []),
    `Bill-to Address(if applicable): ${billTo}`,
    `Return Address: ${returnTo}`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello ${escHtml(request.name || "")}!</p>
    <p style="margin:0 0 16px;">Your RMA Request has been approved and RMA Number for your request is ${escHtml(rma)} .</p>
    <p style="margin:0 0 4px;"><strong>Material to be sent to :</strong> ${escHtml(COMPANY.name)},</p>
    ${rawPara(companyAddressLines.map(escHtml).join("<br/>"))}
    ${fieldTable([
      fieldRow("Date of Request:", requestDate),
      fieldRow("RMA Number:", rma),
      fieldRow("OEM:", request.oem, "Type:", request.serviceType),
      fieldRow("Status:", "Approved", "Status Notes:", statusNotes),
      fieldRowFull("Description of the Issue:", request.description),
      fieldRow("Sender's Full Name:", request.name),
      fieldRow(
        "Sender's Contact No:",
        request.phone,
        "Sender's Company Name:",
        request.company,
      ),
      fieldRow(
        "Sender's Designation:",
        request.designation,
        "Sender's Location:",
        request.location,
      ),
      fieldRow("Email:", request.email),
      fieldRow("Sender's Comapny Address:", billTo),
      fieldRow("Product Model:", request.product),
      ...(isNarda
        ? [
            fieldRow("Base Unit S/N:", request.serialBaseUnit),
            fieldRow("RF Cable S/N:", request.serialRfCable),
            fieldRow("Antenna S/N:", request.serialAntenna),
          ]
        : [fieldRow("Product Serial Number:", request.serialSingle)]),
      ...(isCalibration
        ? [
            fieldRow("PO Number:", request.poNumber),
            fieldRow("PO Date:", formatDate(request.poDate)),
          ]
        : []),
      fieldRow("Bill-to Address(if applicable):", billTo),
      fieldRow("Return Address:", returnTo),
    ])}
  `;

  // No cid image reference is added here on purpose — the PDF (and any
  // logo image) are handled purely as attachments (see approvalAttachments),
  // so they show up below the mail body automatically.
  const attachments = approvalAttachments();
  return {
    subject,
    text,
    html: wrapHtml("", bodyHtml),
    attachments,
  };
}

function buildDisapprovalEmail(request, opts = {}) {
  const id = request.id || "";
  const subject = `RMA Request Disapproved - ${id}`;
  const sign = signature(opts);
  const reason = request.disapprovalReason || "No reason was provided.";
  const text = [
    `Hello, ${request.name || ""}.`,
    "Your RMA has been disapproved",
    `Admin Note: ${reason}`,
    "",
  ].join("\n");
  return buildMessage(subject, text, false);
}

module.exports = {
  buildSubmissionEmail,
  buildAdminSubmissionEmail,
  buildSupportSubmissionEmail,
  buildApprovalEmail,
  buildDisapprovalEmail,
};
