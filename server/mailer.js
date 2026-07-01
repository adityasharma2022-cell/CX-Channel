require("dotenv").config();
const nodemailer = require("nodemailer");

const SENDER_EMAIL =
  process.env.SENDER_EMAIL ||
  process.env.SNEDER_EMAIL ||
  "undefeatedcrplayer@gmail.com";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "email-smtp.ap-south-1.amazonaws.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER_ID,
    pass: process.env.SMTP_USER_PASS,
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
  attachments = [],
}) {
  if (!to) {
    throw new Error("Recipient email (to) is required. Set TEAM_EMAIL in server/.env.");
  }

  return transporter.sendMail({
    from: `"FASCAL Service Portal" <${SENDER_EMAIL}>`,
    to,
    subject,
    text,
    html: html || text,
    replyTo: replyTo || undefined,
    attachments,
  });
}

module.exports = { sendMail, verifyMailer, SENDER_EMAIL };
