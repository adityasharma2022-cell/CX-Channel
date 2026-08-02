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
  const issuedAt = formatDate(request.rmaIssuedAt);
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
    `RMA Number: ${rma}`,
    `RMA Issued Date: ${issuedAt || "-"}`,
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

  // Each field renders as its own block (label above value). Blocks are laid
  // out two-per-row inside an invisible table so multiple fields sit side by
  // side, spaced apart, with no borders or colors.
  const fieldCell = (label, value) =>
    `<td style="padding:4px 20px 4px 0;vertical-align:top;width:50%;">
      <div style="font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px;">${escHtml(label)}</div>
      <div style="word-break:break-word;">${escHtml(value || "-")}</div>
    </td>`;

  // Pairs the given field cells into rows of two columns.
  const gridHtml = (cells) => {
    let rows = "";
    for (let i = 0; i < cells.length; i += 2) {
      rows += `<tr>${cells[i]}${cells[i + 1] || '<td style="width:50%;"></td>'}</tr>`;
    }
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border:0;">${rows}</table>`;
  };

  const h4 = (title) =>
    `<h4 style="margin:16px 0 6px;font-size:15px;">${escHtml(title)}</h4>`;

  // Escapes user-provided content.
  const para = (value) =>
    `<p style="margin:2px 0;line-height:1.5;white-space:pre-wrap;">${escHtml(value || "-")}</p>`;

  // Static company address may contain intentional <br/> tags, so it is NOT
  // escaped.
  const rawPara = (value) =>
    `<p style="margin:2px 0;line-height:1.5;">${value}</p>`;

  const companyAddress = [
    COMPANY.name,
    ...COMPANY.addressLines,
    `Tel. No.: ${COMPANY.phone}`,
    `GST No.: ${COMPANY.gst}`,
  ].join("<br/>");

  const bodyHtml = `
    <p>Hello ${escHtml(request.name || "")},</p>
    <p>Your RMA request has been approved. The RMA number assigned to your request is <strong>${escHtml(rma)}</strong>.</p>
    <p style="margin:14px 0 0;"><strong>RMA Number:</strong> ${escHtml(rma)} &nbsp;&nbsp;&nbsp; <strong>RMA Issued Date:</strong> ${escHtml(issuedAt || "-")}</p>
    ${h4("RMA Details")}
    ${gridHtml([
      fieldCell("RMA Number", rma),
      fieldCell("RMA Issued Date", issuedAt),
      fieldCell("Date of Request", formatDate(request.createdAt)),
      fieldCell("TMI ID", id),
      fieldCell("OEM", request.oem),
      fieldCell("Service Type", request.serviceType),
      fieldCell("Status", "Approved"),
      fieldCell("Status Notes", statusNotes),
    ])}
    ${h4("Customer Details")}
    ${gridHtml([
      fieldCell("Full Name", request.name),
      fieldCell("Contact No", request.phone),
      fieldCell("Company Name", request.company),
      fieldCell("Designation", request.designation),
      fieldCell("Department/Circle", request.location || request.department),
      fieldCell("Email", request.email),
      fieldCell("Company Address", billTo),
    ])}
    ${h4("Product Details")}
    ${gridHtml([
      fieldCell("Product Model", request.product),
      fieldCell("Base Unit", request.serialBaseUnit || request.serialSingle),
      fieldCell("Antenna/Probe", request.serialAntenna),
      fieldCell("Others", request.serialRfCable),
    ])}
    ${h4("Description of the Issue")}
    ${para(request.description)}
    ${h4("Bill-To Address")}
    ${para(billTo)}
    ${h4("Return Address")}
    ${para(returnTo)}
    ${h4("Material to be Sent To")}
    ${rawPara(companyAddress)}
    <p style="margin-top:16px;">Please refer to the attached RMA instruction document for further instructions regarding the return/shipment process.</p>
    <p>Regards,<br/>${escHtml(sign.name)}<br/>${escHtml(sign.company)}</p>
  `;

  const attachments = approvalAttachments();
  const includeCidImage = attachments.some((a) => a.cid);
  return {
    subject,
    text,
    html: wrapHtml(
      "RMA Request Approved",
      bodyHtml +
        (includeCidImage
          ? `<p><img src="cid:image001" alt="Fastech" /></p>`
          : ""),
    ),
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
    "Admin Note:",
    reason,
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
