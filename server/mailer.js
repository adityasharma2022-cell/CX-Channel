// server/mailer.js
require("dotenv").config();
const nodemailer = require("nodemailer");

// Exact match of Python SMTP config:
// smtp.gmail.com | port 587 | STARTTLS | login with email + app password
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,        // false = STARTTLS (same as Python USE_TLS=True on port 587)
  requireTLS: true,     // forces STARTTLS, matching Python's server.starttls()
  auth: {
    user: process.env.SENDER_EMAIL,
    pass: process.env.SENDER_PASSWORD
  },
  tls: {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true
  }
});

async function verifyMailer() {
  return transporter.verify();
}

async function sendMail({ to, subject, text, html }) {
  if (!process.env.SENDER_EMAIL || !process.env.SENDER_PASSWORD)
    throw new Error("SENDER_EMAIL or SENDER_PASSWORD missing in env");
  if (!to) throw new Error("Recipient email missing");

  return transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to,
    subject,
    text,
    html: html || text
  });
}

module.exports = { sendMail, verifyMailer };