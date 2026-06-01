const nodemailer = require("nodemailer");
require("dotenv").config();

const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[mailer] Missing env: ${key}`);
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    minVersion: "TLSv1.2",
    rejectUnauthorized: false,
  },
});

async function verifyMailer() {
  return transporter.verify();
}

async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP credentials missing in .env");
  }
  if (!to) throw new Error("Recipient email missing");
  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
    replyTo: process.env.REPLY_TO || process.env.SMTP_USER,
  });
}

function customerMail(record, action = "submitted") {
  const subject = `FASCAL request ${action}: ${record.id || ""}`.trim();
  const text = `Hello ${record.name || "Customer"},

Your request has been ${action}.
TMI/Request ID: ${record.id || "-"}
OEM: ${record.oem || "-"}
Product: ${record.product || "-"}
Status: ${record.status || "-"}

Regards,
FASCAL Team`;
  const html = `<p>Hello ${record.name || "Customer"},</p><p>Your request has been <b>${action}</b>.</p><ul><li><b>TMI/Request ID:</b> ${record.id || "-"}</li><li><b>OEM:</b> ${record.oem || "-"}</li><li><b>Product:</b> ${record.product || "-"}</li><li><b>Status:</b> ${record.status || "-"}</li></ul><p>Regards,<br/>FASCAL Team</p>`;
  return { to: record.email, subject, text, html };
}

function teamMail(record, action = "submitted") {
  const teamTo = process.env.TEAM_EMAIL || process.env.SMTP_USER;
  const subject = `New request ${action}: ${record.id || ""}`.trim();
  const text = `New request ${action}.

ID: ${record.id || "-"}
Name: ${record.name || "-"}
Email: ${record.email || "-"}
Phone: ${record.phone || "-"}
OEM: ${record.oem || "-"}
Service Type: ${record.serviceType || "-"}
Product: ${record.product || "-"}
Description: ${record.description || "-"}`;
  const html = `<p>New request <b>${action}</b>.</p><ul><li><b>ID:</b> ${record.id || "-"}</li><li><b>Name:</b> ${record.name || "-"}</li><li><b>Email:</b> ${record.email || "-"}</li><li><b>Phone:</b> ${record.phone || "-"}</li><li><b>OEM:</b> ${record.oem || "-"}</li><li><b>Service Type:</b> ${record.serviceType || "-"}</li><li><b>Product:</b> ${record.product || "-"}</li><li><b>Description:</b> ${record.description || "-"}</li></ul>`;
  return { to: teamTo, subject, text, html };
}

async function notifyCustomer(record, action) {
  if (!record.email) return null;
  return sendMail(customerMail(record, action));
}

async function notifyTeam(record, action) {
  const to = process.env.TEAM_EMAIL || process.env.SMTP_USER;
  if (!to) return null;
  return sendMail({ ...teamMail(record, action), to });
}

module.exports = { sendMail, verifyMailer, notifyCustomer, notifyTeam };