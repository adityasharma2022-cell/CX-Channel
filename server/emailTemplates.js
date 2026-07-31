require("dotenv").config();
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
  return m
    ? `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}-${m[3]}`
    : s;
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

function wrapHtml(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <h3>${escHtml(title)}</h3>
    ${bodyHtml}
  </body>
</html>`;
}

function buildMessage(title, subject, text, includeCidImage) {
  let bodyHtml = textToHtml(text);
  if (includeCidImage) {
    bodyHtml += `<p><img src="cid:image001" alt="Fastech" /></p>`;
  }
  return { subject, text, html: wrapHtml(title, bodyHtml) };
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

function approvalAttachments() {
  const attachments = [];
  if (fs.existsSync(INSTRUCTION_PDF)) {
    attachments.push({
      filename: "instruction.pdf",
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
  const subject = `RMA Request Submitted Successfully - TMI ID: ${id}`;
  const text = [
    `Hello ${request.name || ""},`,
    "",
    "Your RMA request has been successfully submitted.",
    "",
    `TMI ID: ${id}`,
    `Date of Submission: ${formatDate(request.createdAt)}`,
    `OEM: ${request.oem || ""}`,
    `Service Type: ${request.serviceType || ""}`,
    "",
    "Our team will review your request and update you once the request has been processed.",
    "",
    "Regards,",
    COMPANY.name,
  ].join("\n");
  return buildMessage("Request Submission", subject, text, false);
}

function buildSupportSubmissionEmail(request) {
  const id = request.id || "";
  const subject = `Support Request Submitted - TMI ID: ${id}`;
  const text = [
    `Hello ${request.name || ""},`,
    "",
    "Your support request has been successfully submitted. Our team will review your request and update you once the request has been processed.",
    "",
    "TMI ID:",
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
    "Department/Circle:",
    request.location || request.department || "",
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
    "Base Unit:",
    request.serialBaseUnit || request.serialSingle || "",
    "",
    "Antenna/Probe:",
    request.serialAntenna || "",
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
    "Regards,",
    COMPANY.name,
  ].join("\n");
  return buildMessage("Support Request Submission", subject, text, false);
}

function buildApprovalEmail(request, opts = {}) {
  const id = request.id || "";
  const rma = displayRma(request.rmaNumber);
  const subject = `RMA Request Approved - RMA Number: ${rma}`;
  const sign = signature(opts);
  const statusNotes =
    opts.statusNotes || request.ipAdminNote || "Approved by Admin";
  const billTo = request.billingAddress || "";
  const returnTo = request.returnAddress || "";

  const text = [
    `Hello ${request.name || ""},`,
    "",
    "Your RMA Request has been approved.",
    "",
    "The RMA Number assigned to your request is:",
    "",
    `RMA Number: ${rma}`,
    "",
    "MATERIAL TO BE SENT TO:",
    "",
    COMPANY.name,
    ...COMPANY.addressLines,
    "",
    `Tel. No.: ${COMPANY.phone}`,
    `GST No.: ${COMPANY.gst}`,
    "",
    "REQUEST DETAILS",
    "",
    "Date of Request:",
    formatDate(request.createdAt),
    "",
    "TMI ID:",
    id,
    "",
    "RMA Number:",
    rma,
    "",
    "OEM:",
    request.oem || "",
    "",
    "Type:",
    request.serviceType || "",
    "",
    "Status:",
    "Approved",
    "",
    "Status Notes:",
    statusNotes,
    "",
    "DESCRIPTION OF THE ISSUE",
    "",
    request.description || "",
    "",
    "CUSTOMER DETAILS",
    "",
    "Sender's Full Name:",
    request.name || "",
    "",
    "Sender's Contact No:",
    request.phone || "",
    "",
    "Sender's Company Name:",
    request.company || "",
    "",
    "Sender's Designation:",
    request.designation || "",
    "",
    "Sender's Department/Circle:",
    request.location || request.department || "",
    "",
    "Email:",
    request.email || "",
    "",
    "Sender's Company Address:",
    billTo,
    "",
    "PRODUCT DETAILS",
    "",
    "Product Model:",
    request.product || "",
    "",
    "Base Unit:",
    request.serialBaseUnit || request.serialSingle || "-",
    "",
    "Antenna/Probe:",
    request.serialAntenna || "-",
    "",
    "Others:",
    request.serialRfCable || "-",
    "",
    "BILL-TO ADDRESS",
    "",
    billTo || "-",
    "",
    "RETURN ADDRESS",
    "",
    returnTo || "-",
    "",
    "Please refer to the attached RMA instruction document for further instructions regarding the return/shipment process.",
    "",
    "Regards,",
    "",
    sign.name,
    sign.company,
  ].join("\n");

  const attachments = approvalAttachments();
  const includeCidImage = attachments.some((a) => a.cid);
  return {
    ...buildMessage("RMA Request Approved", subject, text, includeCidImage),
    attachments,
  };
}

function buildDisapprovalEmail(request, opts = {}) {
  const id = request.id || "";
  const subject = `RMA Request Disapproved - TMI ID: ${id}`;
  const sign = signature(opts);
  const reason = request.disapprovalReason || "No reason was provided.";
  const text = [
    `Hello ${request.name || ""},`,
    "",
    "Your RMA request has been disapproved.",
    "",
    "TMI ID:",
    id,
    "",
    "Status:",
    "Disapproved",
    "",
    "Admin Note:",
    reason,
    "",
    "If you believe this request was disapproved incorrectly, please contact the Fastech RMA team for further assistance.",
    "",
    "Regards,",
    "",
    sign.name,
    sign.company,
  ].join("\n");
  return buildMessage("RMA Request Disapproved", subject, text, false);
}

module.exports = {
  buildSubmissionEmail,
  buildSupportSubmissionEmail,
  buildApprovalEmail,
  buildDisapprovalEmail,
};
