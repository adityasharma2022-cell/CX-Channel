require("dotenv").config();
const nodemailer = require("nodemailer");

const SENDER_EMAIL =
  process.env.SENDER_EMAIL ||
  process.env.SNEDER_EMAIL ||
  "undefeatedcrplayer@gmail.com";

const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.zoho.com",
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: process.env.SENDER_EMAIL,
    pass: process.env.SENDER_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  tls: {
    minVersion: "TLSv1.2",
    rejectUnauthorized: false,
  },
});

async function verifyMailer() {
  return transporter.verify();
}

async function sendMail({
  to,
  subject,
  text,
  html,
  replyTo,
  cc,
  attachments = [],
}) {
  if (!to) {
    throw new Error("Recipient email (to) is required. Set TEAM_EMAIL in server/.env.");
  }

  return transporter.sendMail({
    from: `"FASCAL Service Portal" <${SENDER_EMAIL}>`,
    to,
    cc: cc || process.env.CC_EMAIL || undefined,
    subject,
    text,
    html: html || text,
    replyTo: replyTo || undefined,
    attachments,
  });
}

module.exports = { sendMail, verifyMailer, SENDER_EMAIL };
